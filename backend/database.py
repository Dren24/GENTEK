# ── Database configuration ────────────────────────────────────────────────────
# Uses SQLite stored at ./gentek.db (relative to the backend/ folder).
# check_same_thread=False is required for FastAPI because it runs async handlers
# on different threads than the one that created the connection.

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./gentek.db"

# ── Engine — single shared SQLite connection ──────────────────────────────────
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

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
