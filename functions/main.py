import sys
import os
import asyncio
import io
from firebase_functions import https_fn, scheduler_fn, options
from firebase_admin import initialize_app
import logging

# Standard import relative to functions root
from app.main import app as fastapi_app

initialize_app()
logger = logging.getLogger(__name__)


async def _run_asgi(app, environ):
    """
    Manually invoke ASGI application (FastAPI) from a WSGI environ dict.
    Returns (status_code, headers_dict, body_bytes).
    """
    # Build ASGI scope from WSGI environ
    path = environ.get("PATH_INFO", "/")
    query = environ.get("QUERY_STRING", "")
    method = environ.get("REQUEST_METHOD", "GET")
    
    # Read request body
    content_length = int(environ.get("CONTENT_LENGTH") or 0)
    if content_length > 0:
        body = environ["wsgi.input"].read(content_length)
    else:
        body = b""
    
    # Build headers list from environ
    headers = []
    for key, value in environ.items():
        if key.startswith("HTTP_"):
            header_name = key[5:].lower().replace("_", "-")
            headers.append([header_name.encode(), value.encode()])
        elif key == "CONTENT_TYPE" and value:
            headers.append([b"content-type", value.encode()])
        elif key == "CONTENT_LENGTH" and value:
            headers.append([b"content-length", value.encode()])
    
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "path": path,
        "query_string": query.encode("utf-8") if query else b"",
        "root_path": "",
        "scheme": environ.get("wsgi.url_scheme", "https"),
        "server": (
            environ.get("SERVER_NAME", "localhost"),
            int(environ.get("SERVER_PORT", "443")),
        ),
        "headers": headers,
    }
    
    # Response collection
    response_started = False
    status_code = 500
    response_headers = {}
    body_parts = []
    
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}
    
    async def send(message):
        nonlocal response_started, status_code, response_headers
        if message["type"] == "http.response.start":
            response_started = True
            status_code = message["status"]
            response_headers = {
                k.decode(): v.decode()
                for k, v in message.get("headers", [])
            }
        elif message["type"] == "http.response.body":
            body_parts.append(message.get("body", b""))
    
    # Emit the startup lifespan event only once (first request)
    await app(scope, receive, send)
    
    return status_code, response_headers, b"".join(body_parts)


# Track if startup event has been fired
_startup_done = False


async def _ensure_startup(app):
    """Fire FastAPI startup event if not already done."""
    global _startup_done
    if not _startup_done:
        # Trigger the startup event on the FastAPI app
        await app.router.startup()
        _startup_done = True


@https_fn.on_request(
    region="asia-northeast3",
    min_instances=0,
    max_instances=1,
    memory=options.MemoryOption.GB_1,
    timeout_sec=300,
)
def api(req: https_fn.Request) -> https_fn.Response:
    """Firebase Cloud Function entry point — bridges WSGI to ASGI."""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Ensure startup events are fired
            loop.run_until_complete(_ensure_startup(fastapi_app))
            
            # Run the ASGI app
            status_code, headers, body = loop.run_until_complete(
                _run_asgi(fastapi_app, req.environ)
            )
        finally:
            loop.close()
        
        return https_fn.Response(
            response=body,
            status=status_code,
            headers=headers,
        )
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"ASGI handler error: {error_msg}")
        return https_fn.Response(
            response=f'{{"error": "{str(e)}"}}',
            status=500,
            headers={"Content-Type": "application/json"},
        )


# ──────────────────────────────────────────────
# Scheduled: Auto-settle betting slips every 6 hours
# KST 00:00, 06:00, 12:00, 18:00 = UTC 15:00, 21:00, 03:00, 09:00
# ──────────────────────────────────────────────
@scheduler_fn.on_schedule(
    schedule="0 3,9,15,21 * * *",
    region="asia-northeast3",
    memory=options.MemoryOption.MB_512,
    timeout_sec=120,
)
def auto_settle_scheduled(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Firebase Cloud Scheduler — 6시간마다 경기 결과 자동 정산 (UTC).
    KST 00:00/06:00/12:00/18:00 = UTC 15:00/21:00/03:00/09:00
    하루 4회 × 10개 리그 = ~40 API 요청 (20,000 토큰 중 극소량)
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        # Ensure startup
        loop.run_until_complete(_ensure_startup(fastapi_app))

        from app.services.settlement import auto_settle_slips
        result = loop.run_until_complete(auto_settle_slips())
        logger.info(f"⏰ Scheduled auto-settlement complete: {result}")

        # Save run log to Firestore for monitoring
        try:
            from google.cloud import firestore
            from datetime import datetime, timezone
            db = firestore.Client()
            db.collection("system_logs").document("auto_settle_last_run").set({
                "timestamp": datetime.now(timezone.utc),
                "result": result,
                "trigger": "scheduled_6h",
            })
        except Exception as log_err:
            logger.warning(f"Failed to save settlement log: {log_err}")

    except Exception as e:
        logger.error(f"❌ Scheduled auto-settlement failed: {e}")
    finally:
        loop.close()


# ──────────────────────────────────────────────
# Scheduled: Collect odds from The Odds API every 1 hour
# This is the ONLY code path that consumes API tokens for odds
# ──────────────────────────────────────────────
@scheduler_fn.on_schedule(
    schedule="0 * * * *",
    region="asia-northeast3",
    memory=options.MemoryOption.MB_512,
    timeout_sec=120,
)
def odds_collect_scheduled(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Firebase Cloud Scheduler — 1시간마다 해외 배당 수집.
    The Odds API에서 배당을 가져와 Firestore에 저장.
    사용자 요청은 Firestore에서만 읽으므로 토큰 소모 0.
    하루 24회 × 10개 리그 = ~240 API 토큰 (20,000 중 1.2%)
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(_ensure_startup(fastapi_app))

        from app.services.pinnacle_api import pinnacle_service
        result = loop.run_until_complete(pinnacle_service.refresh_odds())
        count = len(result) if result else 0
        logger.info(f"⏰ Scheduled odds collection complete: {count} items")

        # Save run log to Firestore
        try:
            from google.cloud import firestore
            from datetime import datetime, timezone
            db = firestore.Client()
            db.collection("system_logs").document("odds_collect_last_run").set({
                "timestamp": datetime.now(timezone.utc),
                "odds_count": count,
                "trigger": "scheduled_1h",
                "requests_remaining": pinnacle_service._requests_remaining,
            })
        except Exception as log_err:
            logger.warning(f"Failed to save odds collection log: {log_err}")

    except Exception as e:
        logger.error(f"❌ Scheduled odds collection failed: {e}")
    finally:
        loop.close()

