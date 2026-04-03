from dotenv import load_dotenv
import os
import asyncio
import logging
import time
from collections import defaultdict

# Load .env BEFORE any app module imports so os.getenv() works everywhere
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(env_path)

# ── Firestore에서 API 키 자동 로드 (배포 시 환경변수 소실 방지) ──
try:
    from app.models.config_db import load_config_to_env
    loaded = load_config_to_env()
    if loaded:
        print(f"🔑 Firestore에서 {loaded}개 API 키 로드 완료")
except Exception as _e:
    print(f"⚠️ Firestore config 로드 스킵: {_e}")

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.api.endpoints import admin, odds, auth, payments, portfolio, market, scheduler, analysis, community, prediction, tax, combinator, ai_predictions, notifications
from app.api.endpoints import vip_combo, vip_alerts, vip_portfolio, vip_market
from app.api.endpoints import backtest
from app.api.endpoints import marketing
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(title="Scorenix API")

# ─── CORS 제한 (허용 도메인만) ───
_cors_origins_env = os.getenv("CORS_ORIGINS", "")
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://smart-proto-inv-2026.web.app",
    "https://smart-proto-inv-2026.firebaseapp.com",
    "https://scorenix.com",
    "https://www.scorenix.com",
]
# Cloud Run 서비스 URL 자동 추가
_cloud_run_url = os.getenv("CLOUD_RUN_URL", "")
if _cloud_run_url:
    ALLOWED_ORIGINS.append(_cloud_run_url)
if _cors_origins_env:
    ALLOWED_ORIGINS.extend([o.strip() for o in _cors_origins_env.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Rate Limiting 미들웨어 (60 req/min per IP) ───
class RateLimitStore:
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: dict = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        # 오래된 요청 제거
        self.requests[client_ip] = [t for t in self.requests[client_ip] if now - t < self.window]
        if len(self.requests[client_ip]) >= self.max_requests:
            return False
        self.requests[client_ip].append(now)
        return True

_rate_limiter = RateLimitStore(max_requests=60, window_seconds=60)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    if not _rate_limiter.is_allowed(client_ip):
        return JSONResponse(
            status_code=429,
            content={"detail": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (60 req/min)"},
        )
    response = await call_next(request)
    return response

# Include Routers
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(odds.router, prefix="/api", tags=["odds"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(market.router, prefix="/api/market", tags=["market"])
app.include_router(scheduler.router, prefix="/api/scheduler", tags=["scheduler"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(community.router, prefix="/api/community", tags=["community"])
app.include_router(prediction.router, prefix="/api/prediction", tags=["prediction"])
app.include_router(tax.router, prefix="/api/tax", tags=["tax"])
app.include_router(combinator.router, prefix="/api/combinator", tags=["combinator"])
app.include_router(ai_predictions.router, prefix="/api/ai", tags=["ai"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

# VIP Endpoints
app.include_router(vip_combo.router, prefix="/api/vip/combo", tags=["vip-combo"])
app.include_router(vip_alerts.router, prefix="/api/vip/alerts", tags=["vip-alerts"])
app.include_router(vip_portfolio.router, prefix="/api/vip/portfolio", tags=["vip-portfolio"])
app.include_router(vip_market.router, prefix="/api/vip/market", tags=["vip-market"])

# Backtest Insights
app.include_router(backtest.router, prefix="/api/backtest", tags=["backtest"])

# Marketing (Buffer SNS)
app.include_router(marketing.router, prefix="/api/marketing", tags=["marketing"])


async def _auto_collect_stats():
    """서버 시작 시 자동으로 외부 데이터 수집 (백그라운드)"""
    await asyncio.sleep(1)  # 서버 완전 초기화 대기
    logger.info("🔄 자동 데이터 수집 시작...")
    import time as _t

    from app.models.bets_db import save_stats_cache, load_stats_cache

    # ── STEP 1: 배당 데이터 최우선 수집 ──
    t0 = _t.time()
    from app.services.pinnacle_api import pinnacle_service
    if pinnacle_service.api_key:
        try:
            odds = await pinnacle_service.refresh_odds()
            logger.info(f"  ✅ API-Football Odds: {len(odds)} matches ({_t.time()-t0:.1f}s)")
        except Exception as e:
            logger.warning(f"  ⚠️ API-Football Odds error ({_t.time()-t0:.1f}s): {e}")
    else:
        logger.warning("  ⚠️ API_FOOTBALL_KEY 없음 — mock 데이터 사용 중")

    logger.info("✅ 배당 데이터 수집 완료 — 분석 페이지 사용 가능")

    # ── STEP 2: AI 서비스 초기화 (별도 스레드 — event loop 차단 방지) ──
    t1 = _t.time()
    try:
        await asyncio.to_thread(ai_predictions._ensure_services)
        logger.info(f"  ✅ AI 서비스 초기화 완료 ({_t.time()-t1:.1f}s)")
    except Exception as e:
        logger.warning(f"  ⚠️ AI 서비스 초기화 실패 ({_t.time()-t1:.1f}s): {e}")
        return

    from app.schemas.predictions import TeamStats
    football_stats = ai_predictions.football_stats
    league_standings = ai_predictions.league_standings
    ai_predictor = ai_predictions.ai_predictor

    # ── STEP 3: Firestore 캐시 복원 ──
    t2 = _t.time()
    try:
        cached = await load_stats_cache("ai_stats_snapshot")
        if cached and ai_predictor:
            standings_parsed = {}
            for league, teams in cached.get("standings", {}).items():
                standings_parsed[league] = [TeamStats(**t) for t in teams]
            ai_predictor.update_data(
                standings=standings_parsed or None,
                injuries=cached.get("injuries", {}) or None,
                api_predictions=cached.get("predictions", []) or None,
                h2h=cached.get("h2h", {}) or None,
            )
            logger.info(f"  ✅ Firestore 캐시 복원 ({len(cached.get('standings', {}))} leagues, {_t.time()-t2:.1f}s)")
        else:
            logger.info(f"  📦 Firestore 캐시 없음 ({_t.time()-t2:.1f}s)")
    except Exception as e:
        logger.warning(f"  ⚠️ 캐시 복원 실패 ({_t.time()-t2:.1f}s): {e}")

    # ── STEP 4: 외부 API 순위/통계 수집 ──
    all_stats = {"standings": {}, "injuries": {}, "predictions": [], "h2h": {}}

    # football-data.org
    t3 = _t.time()
    try:
        if league_standings:
            standings_data = await league_standings.collect_all()
            all_stats["standings"].update({
                k: [t if isinstance(t, dict) else t.model_dump() for t in v]
                for k, v in standings_data.items()
            })
            if ai_predictor:
                for league, teams in standings_data.items():
                    if league not in ai_predictor._standings_cache:
                        team_list = [TeamStats(**t) if isinstance(t, dict) else t for t in teams]
                        ai_predictor._standings_cache[league] = team_list
            logger.info(f"  ✅ football-data.org: {len(standings_data)} leagues ({_t.time()-t3:.1f}s)")
    except Exception as e:
        logger.warning(f"  ⚠️ football-data.org error ({_t.time()-t3:.1f}s): {e}")

    # API-Football (일일 100건 제한)
    t4 = _t.time()
    try:
        if football_stats:
            fb_data = await football_stats.collect_all()
            standings_parsed = {}
            for league, teams in fb_data.get("standings", {}).items():
                standings_parsed[league] = [TeamStats(**t) for t in teams]
                all_stats["standings"][league] = teams
            all_stats["injuries"] = fb_data.get("injuries", {})
            all_stats["predictions"] = fb_data.get("predictions", [])
            all_stats["h2h"] = fb_data.get("h2h", {})
            if ai_predictor:
                ai_predictor.update_data(
                    standings=standings_parsed if standings_parsed else None,
                    injuries=fb_data.get("injuries", {}) or None,
                    api_predictions=fb_data.get("predictions", []) or None,
                    h2h=fb_data.get("h2h", {}) or None,
                )
            logger.info(f"  ✅ API-Football: {football_stats._daily_requests} requests ({_t.time()-t4:.1f}s)")
    except Exception as e:
        logger.warning(f"  ⚠️ API-Football error ({_t.time()-t4:.1f}s): {e}")

    # ── STEP 5: Firestore에 수집된 데이터 저장 ──
    try:
        if all_stats.get("standings") or all_stats.get("injuries") or all_stats.get("h2h"):
            await save_stats_cache("ai_stats_snapshot", all_stats)
            logger.info("  💾 Firestore 캐시 저장 완료")
    except Exception as e:
        logger.warning(f"  ⚠️ Firestore 캐시 저장 실패: {e}")

    logger.info(f"✅ 자동 데이터 수집 완료 (총 {_t.time()-t0:.1f}s) — AI 예측 준비됨")


async def _periodic_odds_refresh():
    """30분마다 API-Football에서 배당 데이터 자동 갱신"""
    from app.services.pinnacle_api import pinnacle_service
    await asyncio.sleep(60)  # 시작 후 1분 대기 (첫 수집과 겹치지 않도록)

    while True:
        try:
            await asyncio.sleep(30 * 60)  # 30분 간격
            if pinnacle_service.api_key:
                odds = await pinnacle_service.refresh_odds()
                logger.info(f"🔄 [Auto-Refresh] API-Football: {len(odds)} matches updated")
            else:
                logger.debug("[Auto-Refresh] Skipping — no API key")
        except Exception as e:
            logger.warning(f"[Auto-Refresh] Error: {e}")


async def _periodic_settlement():
    """30분마다 투표 자동 정산 (경기 종료 감지 → 승/패 판정)"""
    await asyncio.sleep(120)  # 시작 후 2분 대기 (데이터 수집 완료 후)

    while True:
        try:
            from app.services.settlement import auto_settle_predictions
            result = await auto_settle_predictions()
            logger.info(f"📊 [Auto-Settlement] {result}")
        except Exception as e:
            logger.warning(f"[Auto-Settlement] Error: {e}")

        await asyncio.sleep(30 * 60)  # 30분 간격


async def _periodic_stats_collection():
    """12시간마다 순위/부상/H2H 자동 수집 (09:00, 21:00 KST 동기화)"""
    from datetime import timezone, timedelta
    KST = timezone(timedelta(hours=9))
    await asyncio.sleep(5 * 60)  # 첫 수집(_auto_collect_stats)과 겹치지 않도록 5분 대기

    while True:
        try:
            now_kst = __import__("datetime").datetime.now(KST)
            # 다음 09:00 또는 21:00까지 대기 시간 계산
            target_hours = [9, 21]
            next_runs = []
            for h in target_hours:
                target = now_kst.replace(hour=h, minute=0, second=0, microsecond=0)
                if target <= now_kst:
                    target += timedelta(days=1)
                next_runs.append(target)
            next_run = min(next_runs)
            wait_seconds = (next_run - now_kst).total_seconds()
            logger.info(f"📅 [Stats-Scheduler] Next collection at {next_run.strftime('%H:%M KST')} (in {wait_seconds/3600:.1f}h)")
            await asyncio.sleep(wait_seconds)

            # 실행
            logger.info("🔄 [Stats-Scheduler] Starting periodic stats collection...")
            import time as _t
            t0 = _t.time()

            try:
                await asyncio.to_thread(ai_predictions._ensure_services)
            except Exception:
                pass

            football_stats = ai_predictions.football_stats
            ai_predictor = ai_predictions.ai_predictor

            if football_stats:
                from app.schemas.predictions import TeamStats
                from app.models.bets_db import save_stats_cache
                fb_data = await football_stats.collect_all()
                standings_parsed = {}
                for league, teams in fb_data.get("standings", {}).items():
                    standings_parsed[league] = [TeamStats(**t) for t in teams]
                if ai_predictor:
                    ai_predictor.update_data(
                        standings=standings_parsed if standings_parsed else None,
                        injuries=fb_data.get("injuries", {}) or None,
                        api_predictions=fb_data.get("predictions", []) or None,
                        h2h=fb_data.get("h2h", {}) or None,
                    )
                # Firestore 캐시 저장
                try:
                    all_stats = {
                        "standings": {k: [t if isinstance(t, dict) else t.model_dump() for t in v]
                                      for k, v in fb_data.get("standings", {}).items()},
                        "injuries": fb_data.get("injuries", {}),
                        "predictions": fb_data.get("predictions", []),
                        "h2h": fb_data.get("h2h", {}),
                    }
                    await save_stats_cache("ai_stats_snapshot", all_stats)
                except Exception as e:
                    logger.warning(f"  ⚠️ Stats cache save failed: {e}")
                logger.info(f"✅ [Stats-Scheduler] Collection done: {football_stats._daily_requests} API calls ({_t.time()-t0:.1f}s)")
            else:
                logger.warning("[Stats-Scheduler] football_stats not initialized")
        except Exception as e:
            logger.error(f"[Stats-Scheduler] Error: {e}")
            await asyncio.sleep(60)  # 에러 시 1분 후 재시도


async def _periodic_nightly_retrain():
    """매일 03:00 KST에 ML 모델 재학습 + 예측 결과 정산"""
    from datetime import timezone, timedelta
    KST = timezone(timedelta(hours=9))
    await asyncio.sleep(10 * 60)  # 시작 10분 대기

    while True:
        try:
            now_kst = __import__("datetime").datetime.now(KST)
            # 다음 03:00 KST까지 대기
            target = now_kst.replace(hour=3, minute=0, second=0, microsecond=0)
            if target <= now_kst:
                target += timedelta(days=1)
            wait_seconds = (target - now_kst).total_seconds()
            logger.info(f"🌙 [Nightly] Next retrain at 03:00 KST (in {wait_seconds/3600:.1f}h)")
            await asyncio.sleep(wait_seconds)

            # 1. 자동 정산 (경기 결과 확인)
            logger.info("🌙 [Nightly] Step 1: Auto-settlement...")
            try:
                from app.services.settlement import auto_settle_slips
                settle_result = await auto_settle_slips()
                logger.info(f"  ✅ Settlement: {settle_result}")
            except Exception as e:
                logger.warning(f"  ⚠️ Settlement error: {e}")

            # 2. AI 예측 채점
            logger.info("🌙 [Nightly] Step 2: Grading AI predictions...")
            try:
                from app.models.bets_db import grade_ai_predictions
                grade_result = await grade_ai_predictions()
                logger.info(f"  ✅ Graded: {grade_result}")
            except Exception as e:
                logger.warning(f"  ⚠️ Grading error: {e}")

            # 3. ML 재학습
            logger.info("🌙 [Nightly] Step 3: ML retraining...")
            try:
                from app.services.self_learning import self_learning_pipeline
                retrain_result = await self_learning_pipeline.run_nightly()
                if retrain_result.get("model_updated"):
                    from app.core.ml_predictor import ml_predictor
                    ml_predictor.reload_model()
                    logger.info("  ✅ ML model updated and reloaded")
                else:
                    logger.info(f"  ℹ️ Retrain result: {retrain_result}")
            except Exception as e:
                logger.warning(f"  ⚠️ Retrain error: {e}")

            logger.info("✅ [Nightly] Pipeline complete")
        except Exception as e:
            logger.error(f"[Nightly] Error: {e}")
            await asyncio.sleep(60)


async def _periodic_sns_publish():
    """매일 10:00, 16:00 KST에 자동 SNS 콘텐츠 발행 (Buffer)"""
    from datetime import timezone, timedelta
    KST = timezone(timedelta(hours=9))
    await asyncio.sleep(10 * 60)  # 초기 데이터 수집 대기

    while True:
        try:
            now_kst = __import__("datetime").datetime.now(KST)
            # 다음 10:00 또는 16:00까지 대기
            target_hours = [10, 16]
            next_runs = []
            for h in target_hours:
                target = now_kst.replace(hour=h, minute=0, second=0, microsecond=0)
                if target <= now_kst:
                    target += timedelta(days=1)
                next_runs.append(target)
            next_run = min(next_runs)
            wait_seconds = (next_run - now_kst).total_seconds()
            logger.info(f"📱 [SNS-Scheduler] Next publish at {next_run.strftime('%H:%M KST')} (in {wait_seconds/3600:.1f}h)")
            await asyncio.sleep(wait_seconds)

            # Buffer 연동 확인
            from app.services.buffer_service import buffer_service
            if not buffer_service.is_configured:
                logger.info("📱 [SNS-Scheduler] BUFFER_ACCESS_TOKEN not set, skipping")
                await asyncio.sleep(3600)
                continue

            # SNS 콘텐츠 생성 및 발행
            from app.services.gemini_service import generate_sns_content
            from app.api.endpoints.ai_predictions import _predictions_cache

            predictions = _predictions_cache
            if not predictions:
                logger.info("📱 [SNS-Scheduler] No predictions cached, skipping")
                await asyncio.sleep(3600)
                continue

            pred_dicts = [p.dict() if hasattr(p, "dict") else p for p in predictions]
            posts = await generate_sns_content(pred_dicts)

            if posts:
                for post in posts:
                    result = await buffer_service.publish_post(text=post["text"])
                    status = "✅" if result.get("success") else "❌"
                    logger.info(f"📱 [SNS-Scheduler] {status} Published: {post['match_id'][:30]}")

                logger.info(f"📱 [SNS-Scheduler] {len(posts)} posts published at {next_run.strftime('%H:%M KST')}")
            else:
                logger.info("📱 [SNS-Scheduler] No high-confidence matches to publish")

        except Exception as e:
            logger.error(f"[SNS-Scheduler] Error: {e}")
            await asyncio.sleep(60)


@app.on_event("startup")
async def startup_event():
    # Ensure API key is set on pinnacle_service
    from app.services.pinnacle_api import pinnacle_service
    api_key = os.getenv("API_FOOTBALL_KEY") or os.getenv("PINNACLE_API_KEY")
    if api_key and not pinnacle_service.api_key:
        pinnacle_service.set_api_key(api_key)
    print(f"Backend Startup: Firestore mode | API-Football Key: {'✅' if pinnacle_service.api_key else '❌'}")

    # 백그라운드 스케줄러 시작
    asyncio.create_task(_auto_collect_stats())         # 시작 시 1회 전체 수집
    asyncio.create_task(_periodic_odds_refresh())       # 매 30분 배당 갱신
    asyncio.create_task(_periodic_settlement())         # 매 30분 자동 정산
    asyncio.create_task(_periodic_stats_collection())   # 12시간마다 순위/부상/H2H (09:00, 21:00 KST)
    asyncio.create_task(_periodic_nightly_retrain())    # 매일 03:00 KST ML 재학습
    asyncio.create_task(_periodic_sns_publish())        # 매일 10:00, 16:00 KST SNS 자동 발행
    logger.info("🚀 All background schedulers started (including SNS auto-publish)")

@app.get("/")
def read_root():
    return {"message": "Welcome to Scorenix API"}

