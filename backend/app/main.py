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

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.api.endpoints import admin, odds, auth, payments, portfolio, market, scheduler, analysis, community, prediction, tax, combinator, ai_predictions, notifications
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


async def _auto_collect_stats():
    """서버 시작 시 자동으로 외부 데이터 수집 (백그라운드)"""
    await asyncio.sleep(2)  # 서버 완전 초기화 대기
    logger.info("🔄 자동 데이터 수집 시작...")

    from app.services.football_stats_service import FootballStatsService
    from app.services.league_standings_service import LeagueStandingsService
    from app.core.ai_predictor import AIPredictor
    from app.schemas.predictions import TeamStats

    # 각 엔드포인트에서 사용하는 싱글턴 인스턴스 가져오기
    football_stats = ai_predictions.football_stats
    league_standings = ai_predictions.league_standings
    ai_predictor = ai_predictions.ai_predictor

    # 1. football-data.org (무료, 순위 데이터)
    try:
        standings_data = await league_standings.collect_all()
        for league, teams in standings_data.items():
            if league not in ai_predictor._standings_cache:
                ai_predictor._standings_cache[league] = [TeamStats(**t) for t in teams]
        logger.info(f"  ✅ football-data.org: {len(standings_data)} leagues loaded")
    except Exception as e:
        logger.warning(f"  ⚠️ football-data.org error: {e}")

    # 2. API-Football (일일 100건 제한 → 순위+부상만 우선 수집, ~18 requests)
    try:
        fb_data = await football_stats.collect_all()
        standings_parsed = {}
        for league, teams in fb_data.get("standings", {}).items():
            standings_parsed[league] = [TeamStats(**t) for t in teams]
        ai_predictor.update_data(
            standings=standings_parsed if standings_parsed else None,
            injuries=fb_data.get("injuries", {}) or None,
            api_predictions=fb_data.get("predictions", []) or None,
        )
        logger.info(f"  ✅ API-Football: {football_stats._daily_requests} requests used")
    except Exception as e:
        logger.warning(f"  ⚠️ API-Football error: {e}")

    logger.info("✅ 자동 데이터 수집 완료 — AI 예측 준비됨")


@app.on_event("startup")
async def startup_event():
    # Firestore initialization is lazy/singleton
    # Ensure API key is set on pinnacle_service (safety net)
    from app.services.pinnacle_api import pinnacle_service
    api_key = os.getenv("PINNACLE_API_KEY")
    if api_key and not pinnacle_service.api_key:
        pinnacle_service.set_api_key(api_key)
    print(f"Backend Startup: Firestore mode | API Key: {'✅' if pinnacle_service.api_key else '❌'}")

    # 백그라운드에서 데이터 자동 수집 시작
    asyncio.create_task(_auto_collect_stats())

@app.get("/")
def read_root():
    return {"message": "Welcome to Scorenix API"}

