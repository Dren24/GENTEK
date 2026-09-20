# ── FastAPI app entry point ───────────────────────────────────────────────────
# Creates all DB tables on startup, registers routers, and serves the React
# build in production (when dist/ folder exists after `npm run build`).

import os
import re
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Optional

from database import engine, Base, get_db, SessionLocal
from models import User
from analyzer import analyze
import auth

# ── Create DB tables on startup (no-op if they already exist) ─────────────────
Base.metadata.create_all(bind=engine)

# ── Migrate existing DB — add columns that didn't exist in earlier versions ────
with engine.connect() as _conn:
    for _sql in [
        "ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN google_id VARCHAR(255)",
        "ALTER TABLE password_reset_tokens ADD COLUMN id INTEGER",  # no-op guard
    ]:
        try:
            _conn.execute(text(_sql))
            _conn.commit()
        except Exception:
            pass  # column already exists — safe to ignore

# ── Seed a DEV/TEST Premium account — local SQLite dev only, never touches a
# real (Railway/Postgres) production database. Lets Premium behavior be tested
# end-to-end without a real payment processor. Idempotent: only inserts if the
# email doesn't already exist. Clearly named so it can't be mistaken for a
# real paying customer.
if not os.getenv("DATABASE_URL"):
    _seed_db = SessionLocal()
    try:
        if not _seed_db.query(User).filter(User.email == "premiumtest@gentek.local").first():
            _seed_db.add(User(
                name="[DEV TEST] Premium Account",
                email="premiumtest@gentek.local",
                password=auth.hash_password("PremiumTest123!"),
                is_premium=1,
            ))
            _seed_db.commit()
    finally:
        _seed_db.close()

# ── FastAPI app instance ──────────────────────────────────────────────────────
app = FastAPI(title="GENTEK Bias Analyzer API", version="1.0.0")

# ── CORS — allow Vite dev server and local React builds ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ── Auth router — /auth/register, /auth/login, /auth/history/... ──────────────
app.include_router(auth.router)


# ── Analyze request schema ────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    text: str


# ── Free-plan word limit — keep in sync with VITE_FREE_WORD_LIMIT on the
# frontend (that copy drives the UI fade/lock; this one is what's actually
# enforced, so the limit can't be bypassed by calling the API directly). ──────
FREE_WORD_LIMIT = int(os.getenv("FREE_WORD_LIMIT", "500"))


# ── GET /health — simple uptime check ────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── POST /analyze — run gender bias detection on submitted text ───────────────
# Returns detected patterns, score, classification, and highlighted HTML.
# Optionally authenticated: guests and Free accounts are capped at
# FREE_WORD_LIMIT words server-side — the frontend's own truncation is only a
# UX nicety, this is the actual enforcement, so it holds even if the client
# is modified to send the full text. Premium accounts are never capped.
@app.post("/analyze")
def analyze_text(
    req: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(auth.get_current_user_optional),
):
    if not req.text or not req.text.strip():
        return {"error": "Text is required"}

    is_premium = False
    if current_user:
        user = db.query(User).filter(User.id == current_user["id"]).first()
        is_premium = bool(user.is_premium) if user else False

    text_to_analyze = req.text
    if not is_premium:
        matches = list(re.finditer(r"\S+", req.text))
        if len(matches) > FREE_WORD_LIMIT:
            boundary = matches[FREE_WORD_LIMIT - 1].end()
            text_to_analyze = req.text[:boundary]

    return analyze(text_to_analyze)


# ── Static file serving — React production build ──────────────────────────────
# Only active when dist/ exists (i.e. after `npm run build`).
# In development, Vite's dev server handles static files instead.
DIST = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    # ── Catch-all: serve index.html for all client-side React routes ──────────
    @app.get("/{full_path:path}")
    def serve_react(full_path: str):
        return FileResponse(os.path.join(DIST, "index.html"))
