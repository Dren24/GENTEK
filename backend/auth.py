# ── Auth & history routes ────────────────────────────────────────────────────
# All routes are prefixed with /auth (e.g. POST /auth/register).
# Passwords are hashed with bcrypt — never stored or returned in plain text.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import bcrypt
import secrets
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

from database import get_db
from models import User, Analysis, PasswordResetToken

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
    return {"id": user.id, "name": user.name, "email": user.email, "email_notifications": bool(user.email_notifications)}


# ── POST /auth/login — verify credentials and return user ────────────────────
# 401 on wrong email or password (single generic message to avoid user enumeration).
@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"id": user.id, "name": user.name, "email": user.email, "email_notifications": bool(user.email_notifications)}


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


# ── PUT /auth/change-password/{user_id} — verify current pw then update ──────
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

@router.put("/change-password/{user_id}")
def change_password(user_id: int, req: ChangePasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(req.current_password, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    user.password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ── PUT /auth/notifications/{user_id} — save email notification preference ───
class NotificationsRequest(BaseModel):
    email_notifications: bool

@router.put("/notifications/{user_id}")
def update_notifications(user_id: int, req: NotificationsRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email_notifications = 1 if req.email_notifications else 0
    db.commit()
    return {"email_notifications": bool(user.email_notifications)}


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


# ── Email helper — sends password reset link via Gmail SMTP ──────────────────
def send_reset_email(to_email: str, to_name: str, reset_url: str):
    gmail_user     = os.getenv("GMAIL_USER", "")
    gmail_password = os.getenv("GMAIL_APP_PASSWORD", "")
    if not gmail_user or not gmail_password:
        return  # silently skip if not configured

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:22px;font-weight:800;color:#0D9488">GENTEK</span>
      </div>
      <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">Reset your password</h2>
      <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:24px">
        Hi {to_name}, we received a request to reset your GENTEK password.
        Click the button below — this link expires in <strong>1 hour</strong>.
      </p>
      <a href="{reset_url}"
         style="display:inline-block;background:#0D9488;color:#fff;font-weight:700;
                font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none">
        Reset Password
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your GENTEK password"
    msg["From"]    = gmail_user
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(gmail_user, gmail_password)
        smtp.sendmail(gmail_user, to_email, msg.as_string())


# ── POST /auth/forgot-password — generate token and send reset email ──────────
# Always returns 200 even if email not found (prevents user enumeration).
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    reset_url = None
    if user:
        # Delete any existing tokens for this user before creating a new one
        db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
        token      = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)
        db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
        db.commit()
        app_url   = os.getenv("APP_URL", "http://localhost:5173")
        reset_url = f"{app_url}/reset-password?token={token}"
        try:
            send_reset_email(user.email, user.name, reset_url)
        except Exception:
            pass
    return {
        "message": "If that email exists, a reset link has been sent.",
        "reset_url": reset_url,
    }


# ── POST /auth/reset-password — validate token and update password ────────────
class ResetPasswordRequest(BaseModel):
    token:        Optional[str] = None
    email:        Optional[EmailStr] = None
    new_password: str

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    record = None
    if req.token:
        record = db.query(PasswordResetToken).filter(PasswordResetToken.token == req.token).first()
        if not record or record.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")
        user = db.query(User).filter(User.id == record.user_id).first()
    elif req.email:
        user = db.query(User).filter(User.email == req.email).first()
    else:
        raise HTTPException(status_code=400, detail="Reset token or email is required")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password = hash_password(req.new_password)
    if record:
        db.delete(record)
    db.commit()
    return {"message": "Password updated successfully"}


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
