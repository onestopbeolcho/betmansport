from dotenv import load_dotenv
import os

# Load .env BEFORE any app module imports so os.getenv() works everywhere
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(env_path)

from fastapi import FastAPI
from app.api.endpoints import admin, odds, auth, payments, portfolio, market, scheduler, analysis, community, prediction, tax, combinator, ai_predictions
from fastapi.middleware.cors import CORSMiddleware
# Models are now Firestore helpers
# import app.models.bets_db
# import app.models.config_db
# import app.models.user_db

app = FastAPI(title="Smart Proto Investor API")

# CORS Setup (Allow Frontend to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.on_event("startup")
async def startup_event():
    # Firestore initialization is lazy/singleton
    # Ensure API key is set on pinnacle_service (safety net)
    from app.services.pinnacle_api import pinnacle_service
    api_key = os.getenv("PINNACLE_API_KEY")
    if api_key and not pinnacle_service.api_key:
        pinnacle_service.set_api_key(api_key)
    print(f"Backend Startup: Firestore mode | API Key: {'✅' if pinnacle_service.api_key else '❌'}")

@app.get("/")
def read_root():
    return {"message": "Welcome to Smart Proto Investor API"}
