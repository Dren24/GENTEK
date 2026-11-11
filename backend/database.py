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
# pool_pre_ping checks a pooled connection before reusing it. Neon closes idle
# connections, and without this the first request after a quiet period
# failed with a 500 when it got a dead connection. pool_recycle replaces
# connections older than 5 minutes for the same reason.
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True, pool_recycle=300)

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
