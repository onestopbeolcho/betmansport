from fastapi import FastAPI
from app.api.endpoints import admin, odds
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/")
def read_root():
    return {"message": "Welcome to Smart Proto Investor API"}
