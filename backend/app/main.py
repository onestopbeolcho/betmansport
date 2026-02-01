from fastapi import FastAPI
from app.api.endpoints import admin, odds
from fastapi.middleware.cors import CORSMiddleware
from app.db.base import Base
from app.db.session import engine
# Import models to register them with Base.metadata
import app.models.bets_db
import app.models.config_db

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

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
def read_root():
    return {"message": "Welcome to Smart Proto Investor API"}
