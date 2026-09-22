# ── Database configuration ────────────────────────────────────────────────────
# Uses PostgreSQL in production (DATABASE_URL env var set by Railway).
# Falls back to local SQLite for development when DATABASE_URL is not set.

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gentek.db").strip()

# Railway provides postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False; PostgreSQL does not
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# ── Session factory — one session per request, no auto-commit ─────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── Declarative base — all ORM models (User, Analysis) inherit from this ──────
Base = declarative_base()


# ── get_db dependency ─────────────────────────────────────────────────────────
# FastAPI injects this into route handlers via Depends(get_db).
# Opens a DB session, yields it, and guarantees close() even on errors.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
