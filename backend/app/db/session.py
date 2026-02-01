from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Default to SQLite for Development, can hold PG URL later
# Use absolute path for SQLite to avoid CWD issues
db_path = BASE_DIR / "test.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path}")

engine = create_async_engine(
    DATABASE_URL,
    echo=True, # Log SQL for debugging
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    try:
        with open("db_debug.log", "w") as f:
            f.write(f"PATH: {db_path}\n")
    except: pass

    try:
        async with AsyncSessionLocal() as session:
            print(">>> session created")
            yield session
            print(">>> session yielded")
    except Exception as e:
        print(f">>> get_db FAILED: {e}")
        raise e
