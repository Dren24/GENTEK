# ── Auth & history routes ────────────────────────────────────────────────────
# All routes are prefixed with /auth (e.g. POST /auth/register).
# Passwords are hashed with bcrypt — never stored or returned in plain text.
# Protected routes require a valid JWT Bearer token (issued at login/register).

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
import bcrypt
import secrets
import smtplib
import os
import requests
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

from database import get_db
from models import User, Analysis, PasswordResetToken

router = APIRouter(prefix="/auth", tags=["auth"])

# ── JWT configuration ─────────────────────────────────────────────────────────
# No hardcoded fallback secret — a known string baked into source would let
# anyone forge tokens for any user. If JWT_SECRET isn't set, generate a random
# one for this process (existing sessions won't survive a restart, but that's
# far safer than a guessable default). Set JWT_SECRET in production.
_JWT_SECRET = os.getenv("JWT_SECRET")
if not _JWT_SECRET:
    _JWT_SECRET = secrets.token_hex(32)
    print("[auth] WARNING: JWT_SECRET not set — using a random secret for this process only. Set JWT_SECRET in your environment for stable sessions across restarts.")
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRE_DAYS = 30           # "Remember me" checked — survives browser restarts
_JWT_EXPIRE_HOURS_SHORT = 12    # "Remember me" unchecked — short-lived, paired with sessionStorage on the frontend

_bearer = HTTPBearer()
_bearer_optional = HTTPBearer(auto_error=False)


def _create_token(user_id: int, name: str, email: str, remember: bool = True) -> str:
    """Sign a JWT containing user identity. Expiry depends on "Remember me":
    30 days when remembered, a short 12-hour session otherwise (the frontend
    pairs this with sessionStorage vs localStorage for the matching lifetime)."""
    exp_delta = timedelta(days=_JWT_EXPIRE_DAYS) if remember else timedelta(hours=_JWT_EXPIRE_HOURS_SHORT)
    payload = {
        "sub":   str(user_id),
        "name":  name,
        "email": email,
        "exp":   datetime.utcnow() + exp_delta,
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(_bearer)) -> dict:
    """JWT auth middleware — validates Bearer token and returns the decoded user."""
    try:
        payload = jwt.decode(credentials.credentials, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": int(user_id), "name": payload.get("name"), "email": payload.get("email")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Security(_bearer_optional)) -> Optional[dict]:
    """Like get_current_user, but returns None instead of raising when no/invalid
    token is present — lets a route serve both guests and logged-in users while
    still being able to identify who's calling (used by /analyze for the
    server-side Free-plan word limit, so it can't be bypassed from the client)."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return {"id": int(user_id), "name": payload.get("name"), "email": payload.get("email")}
    except JWTError:
        return None

# ── Valid classification values — rejects unknown strings before DB insert ─────
VALID_CLASSIFICATIONS = {"MALE-BIASED", "FEMALE-BIASED", "GENDER-NEUTRAL"}

# ── Google Sign-In config ──────────────────────────────────────────────────────
# GOOGLE_CLIENT_ID must match the OAuth 2.0 Web Client ID configured in Google
# Cloud Console (the same value the frontend uses as VITE_GOOGLE_CLIENT_ID).
# Never store a Google client *secret* here — the token-client flow used by the
# frontend doesn't need one, only the client ID (which is not a secret).
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_USERINFO_URL  = "https://www.googleapis.com/oauth2/v3/userinfo"


# ── Request schemas (Pydantic) ────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    # Plain str, not EmailStr — login only needs to match an existing row, and
    # EmailStr's RFC validation rejects reserved TLDs like .local (used by the
    # seeded DEV/TEST account in main.py). A malformed value just won't match
    # any user and falls through to the normal "Invalid email or password".
    email: str
    password: str
    remember: bool = True   # False = short-lived token, paired with sessionStorage on the frontend


# ── Google Sign-In payload — the frontend sends only the opaque OAuth access
# token it got from Google; identity is always verified server-side from it,
# never trusted from client-supplied fields. ───────────────────────────────────
class GoogleAuthRequest(BaseModel):
    access_token: str
    remember: bool = True


# ── Analysis create payload ───────────────────────────────────────────────────
class AnalysisIn(BaseModel):
    label: str           # truncated preview shown in sidebar (≤ 48 chars)
    text: str
    score: float
    classification: str  # MALE-BIASED | FEMALE-BIASED | GENDER-NEUTRAL


# ── Analysis update payload (re-analyze same entry) ──────────────────────────
class AnalysisUpdate(BaseModel):
    score: float
    classification: str


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt. Never store the plain value."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Return True if password matches the bcrypt hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ── POST /auth/register — create new account ──────────────────────────────────
# Returns the new user's id, name, and email (no password).
# 400 if the email is already registered.
@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
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
    token = _create_token(user.id, user.name, user.email)
    return {"id": user.id, "name": user.name, "email": user.email, "email_notifications": bool(user.email_notifications), "is_premium": bool(user.is_premium), "token": token}


# ── POST /auth/login — verify credentials and return user ────────────────────
# 401 on wrong email or password (single generic message to avoid user enumeration).
@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = _create_token(user.id, user.name, user.email, remember=req.remember)
    return {"id": user.id, "name": user.name, "email": user.email, "email_notifications": bool(user.email_notifications), "is_premium": bool(user.is_premium), "token": token}


# ── POST /auth/google — verify a Google OAuth access token and log in/register ──
# Flow: frontend gets an access token from Google Identity Services -> sends it
# here -> we ask Google directly who it belongs to (never trust client-supplied
# identity claims) -> find-or-create the matching GENTEK account -> issue our
# own normal JWT, exactly like email/password login.
@router.post("/google")
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    # Step 1: confirm the token was actually issued for this app before doing
    # anything else with it.
    try:
        info_resp = requests.get(
            GOOGLE_TOKENINFO_URL,
            params={"access_token": req.access_token},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach Google to verify credential")
    if info_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google credential")
    tokeninfo = info_resp.json()
    if tokeninfo.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google credential was not issued for this app")

    # Step 2: fetch the verified profile for that token (email, name, stable id)
    try:
        userinfo_resp = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {req.access_token}"},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach Google to verify credential")
    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google credential")
    userinfo = userinfo_resp.json()

    google_id = userinfo.get("sub")
    email     = userinfo.get("email")
    if not google_id or not email:
        raise HTTPException(status_code=401, detail="Google account is missing required information")
    if not userinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email is not verified")
    name = userinfo.get("name") or email.split("@")[0]

    # Step 3: find-or-create — link to an existing account by google_id first,
    # then by email (so a prior email/password signup isn't duplicated), else
    # create a fresh GENTEK account. Google users get an unusable random
    # password hash — they never set one and can't log in with it.
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_id
        else:
            user = User(
                name=name,
                email=email,
                password=hash_password(secrets.token_urlsafe(32)),
                google_id=google_id,
            )
            db.add(user)
        db.commit()
        db.refresh(user)

    token = _create_token(user.id, user.name, user.email, remember=req.remember)
    return {"id": user.id, "name": user.name, "email": user.email, "email_notifications": bool(user.email_notifications), "is_premium": bool(user.is_premium), "token": token}


# ── Update name schema — narrower than RegisterRequest (no password field) ────
class UpdateNameRequest(BaseModel):
    name: str

# ── PUT /auth/update/{user_id} — update display name ─────────────────────────
# Only the name field is updated. Returns full user object so frontend can refresh.
@router.put("/update/{user_id}")
def update_user(user_id: int, req: UpdateNameRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name = req.name
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "email_notifications": bool(user.email_notifications), "is_premium": bool(user.is_premium)}


# ── PUT /auth/change-password/{user_id} — verify current pw then update ──────
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

@router.put("/change-password/{user_id}")
def change_password(user_id: int, req: ChangePasswordRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
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
def update_notifications(user_id: int, req: NotificationsRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email_notifications = 1 if req.email_notifications else 0
    db.commit()
    return {"email_notifications": bool(user.email_notifications)}


# ── DELETE /auth/delete/{user_id} — permanently remove account ───────────────
# Cascades to all analyses owned by this user (see models.py relationship).
@router.delete("/delete/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "Account deleted"}


# ── POST /auth/history/{user_id} — save a new analysis ───────────────────────
# Validates user existence and classification before inserting.
# Returns the new DB row id so the frontend can track it for future updates.
@router.post("/history/{user_id}")
def save_analysis(user_id: int, req: AnalysisIn, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if req.classification not in VALID_CLASSIFICATIONS:
        raise HTTPException(status_code=400, detail="Invalid classification value")
    if not db.query(User).filter(User.id == user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
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
def update_analysis(user_id: int, analysis_id: int, req: AnalysisUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    item = db.query(Analysis).filter(Analysis.id == analysis_id, Analysis.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Analysis not found")
    item.score = req.score
    item.classification = req.classification
    db.commit()
    return {"message": "Updated"}


# ── DELETE /auth/history/{user_id}/{analysis_id} — remove one analysis ────────
@router.delete("/history/{user_id}/{analysis_id}")
def delete_analysis(user_id: int, analysis_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
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

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as smtp:
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
        # On Vercel, a serverless function's execution can be frozen/killed as
        # soon as the response is sent — a background thread isn't guaranteed
        # to finish, so send synchronously there. Everywhere else (Docker,
        # Railway, local dev) keep it backgrounded so the response isn't
        # delayed by the SMTP round-trip.
        if os.getenv("VERCEL"):
            send_reset_email(user.email, user.name, reset_url)
        else:
            threading.Thread(
                target=send_reset_email,
                args=(user.email, user.name, reset_url),
                daemon=True,
            ).start()
    # Never return reset_url — it would leak whether the email is registered
    return {"message": "If that email exists, a reset link has been sent."}


# ── POST /auth/reset-password — validate token and update password ────────────
# Token is required — the email-only path was removed because it allowed
# unauthenticated password resets by anyone who knows a target email address.
class ResetPasswordRequest(BaseModel):
    token:        str   # required — issued by /forgot-password
    new_password: str

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    record = db.query(PasswordResetToken).filter(PasswordResetToken.token == req.token).first()
    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    user = db.query(User).filter(User.id == record.user_id).first()
    # Always delete the used token, even if the user no longer exists
    db.delete(record)
    if not user:
        db.commit()
        raise HTTPException(status_code=404, detail="User not found")
    user.password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ── GET /auth/history/{user_id} — fetch recent analyses for sidebar ───────────
# Returns the 20 most recent analyses, newest first.
# timestamp is converted to JS-compatible milliseconds (Date.now() format).
@router.get("/history/{user_id}")
def get_history(user_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
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
            # Guard against None created_at (row without ORM-side default)
            "timestamp": (item.created_at.timestamp() * 1000) if item.created_at else 0,
        }
        for item in items
    ]
