# ── Auth & history routes ────────────────────────────────────────────────────
# All routes are prefixed with /auth (e.g. POST /auth/register).
# Passwords are hashed with bcrypt — never stored or returned in plain text.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import bcrypt

from database import get_db
from models import User, Analysis

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Request schemas (Pydantic) ────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Analysis create payload ───────────────────────────────────────────────────
class AnalysisIn(BaseModel):
    label: str           # truncated preview shown in sidebar (≤ 48 chars)
    text: str
    score: float
    classification: str  # MALE-BIASED | FEMALE-BIASED | GENDER-NEUTRAL | MIXED-BIAS


# ── Analysis update payload (re-analyze same entry) ──────────────────────────
class AnalysisUpdate(BaseModel):
    score: float
    classification: str


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ── POST /auth/register — create new account ──────────────────────────────────
# Returns the new user's id, name, and email (no password).
# 400 if the email is already registered.
@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=req.name,
        email=req.email,
        password=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email}


# ── POST /auth/login — verify credentials and return user ────────────────────
# 401 on wrong email or password (single generic message to avoid user enumeration).
@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"id": user.id, "name": user.name, "email": user.email}


# ── PUT /auth/update/{user_id} — update display name ─────────────────────────
# Only the name field is updated. Email and password are not changed here.
@router.put("/update/{user_id}")
def update_user(user_id: int, req: RegisterRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name = req.name
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email}


# ── DELETE /auth/delete/{user_id} — permanently remove account ───────────────
# Cascades to all analyses owned by this user (see models.py relationship).
@router.delete("/delete/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "Account deleted"}


# ── POST /auth/history/{user_id} — save a new analysis ───────────────────────
# Returns the new DB row id so the frontend can track it for future updates.
@router.post("/history/{user_id}")
def save_analysis(user_id: int, req: AnalysisIn, db: Session = Depends(get_db)):
    analysis = Analysis(
        user_id=user_id,
        label=req.label,
        text=req.text,
        score=req.score,
        classification=req.classification,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return {"id": analysis.id}


# ── PUT /auth/history/{user_id}/{analysis_id} — update existing analysis ──────
# Called when the user re-analyzes the same text (history deduplication).
# Only score and classification change; text and label stay the same.
@router.put("/history/{user_id}/{analysis_id}")
def update_analysis(user_id: int, analysis_id: int, req: AnalysisUpdate, db: Session = Depends(get_db)):
    item = db.query(Analysis).filter(Analysis.id == analysis_id, Analysis.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Analysis not found")
    item.score = req.score
    item.classification = req.classification
    db.commit()
    return {"message": "Updated"}


# ── DELETE /auth/history/{user_id}/{analysis_id} — remove one analysis ────────
@router.delete("/history/{user_id}/{analysis_id}")
def delete_analysis(user_id: int, analysis_id: int, db: Session = Depends(get_db)):
    item = db.query(Analysis).filter(Analysis.id == analysis_id, Analysis.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Analysis not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted"}


# ── GET /auth/history/{user_id} — fetch recent analyses for sidebar ───────────
# Returns the 20 most recent analyses, newest first.
# timestamp is converted to JS-compatible milliseconds (Date.now() format).
@router.get("/history/{user_id}")
def get_history(user_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(Analysis)
        .filter(Analysis.user_id == user_id)
        .order_by(Analysis.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": item.id,
            "label": item.label,
            "text": item.text,
            "score": item.score,
            "classification": item.classification,
            "timestamp": item.created_at.timestamp() * 1000,  # JS milliseconds
        }
        for item in items
    ]
