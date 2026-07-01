# ── FastAPI app entry point ───────────────────────────────────────────────────
# Creates all DB tables on startup, registers routers, and serves the React
# build in production (when dist/ folder exists after `npm run build`).

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import engine, Base
from analyzer import analyze
import auth

# ── Create DB tables on startup (no-op if they already exist) ─────────────────
Base.metadata.create_all(bind=engine)

# ── FastAPI app instance ──────────────────────────────────────────────────────
app = FastAPI(title="GENTEK Bias Analyzer API", version="1.0.0")

# ── CORS — allow Vite dev server and local React builds ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ── Auth router — /auth/register, /auth/login, /auth/history/... ──────────────
app.include_router(auth.router)


# ── Analyze request schema ────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    text: str


# ── GET /health — simple uptime check ────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── POST /analyze — run gender bias detection on submitted text ───────────────
# Returns detected patterns, score, classification, and highlighted HTML.
@app.post("/analyze")
def analyze_text(req: AnalyzeRequest):
    if not req.text or not req.text.strip():
        return {"error": "Text is required"}
    return analyze(req.text)


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
