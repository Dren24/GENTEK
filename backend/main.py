import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import engine, Base
from analyzer import analyze
import auth

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="GENTEK Bias Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Auth routes
app.include_router(auth.router)


class AnalyzeRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/analyze")
def analyze_text(req: AnalyzeRequest):
    if not req.text or not req.text.strip():
        return {"error": "Text is required"}
    return analyze(req.text)


# Serve React build in production (when dist/ exists)
DIST = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_react(full_path: str):
        return FileResponse(os.path.join(DIST, "index.html"))
