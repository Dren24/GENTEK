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
import hashlib
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
from html import escape

load_dotenv()

from database import get_db
from models import User, Analysis, PasswordResetToken, EmailCode, TrustedDevice

router = APIRouter(prefix="/auth", tags=["auth"])

# ── JWT configuration ─────────────────────────────────────────────────────────
# No hardcoded fallback secret — a known string baked into source would let
# anyone forge tokens for any user. If JWT_SECRET isn't set, generate a random
# one for this process (existing sessions won't survive a restart, but that's
# far safer than a guessable default). Set JWT_SECRET in production.
_JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
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
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
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
    device_token: Optional[str] = None  # from a previous verified login on this browser


class VerifyCodeRequest(BaseModel):
    email: str
    code: str
    purpose: str            # 'verify' (sign-up) | 'login' (new browser)
    remember: bool = True


class ResendCodeRequest(BaseModel):
    email: str
    purpose: str


# ── Google Sign-In payload — the frontend sends only the opaque OAuth access
# token it got from Google; identity is always verified server-side from it,
# never trusted from client-supplied fields. ───────────────────────────────────
class GoogleAuthRequest(BaseModel):
    access_token: str
    remember: bool = True


# ── Email verification config ─────────────────────────────────────────────────
CODE_TTL_MINUTES       = 10
CODE_MAX_ATTEMPTS      = 5     # wrong guesses before the code is burned
CODE_RESEND_SECONDS    = 60
TRUSTED_DEVICE_DAYS    = 30
CODE_PURPOSES          = {"verify", "login"}
# Local dev (SQLite, no DATABASE_URL) also prints codes to the server log, so
# seeded test accounts with undeliverable addresses can still log in.
_DEV_MODE = not os.getenv("DATABASE_URL")


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _user_payload(user: User, db: Session, remember: bool, new_device: bool = False) -> dict:
    """The normal logged-in response. With new_device, also trusts this browser
    for TRUSTED_DEVICE_DAYS and returns the token it should keep."""
    payload = {
        "id": user.id, "name": user.name, "email": user.email,
        "email_notifications": bool(user.email_notifications), "is_premium": bool(user.is_premium),
        "token": _create_token(user.id, user.name, user.email, remember=remember),
    }
    if new_device:
        device_token = secrets.token_urlsafe(32)
        db.add(TrustedDevice(
            user_id=user.id, token_hash=_sha256(device_token),
            expires_at=datetime.utcnow() + timedelta(days=TRUSTED_DEVICE_DAYS),
        ))
        db.commit()
        payload["device_token"] = device_token
    return payload


def _is_trusted_device(user: User, device_token: Optional[str], db: Session) -> bool:
    if not device_token:
        return False
    device = db.query(TrustedDevice).filter(
        TrustedDevice.user_id == user.id,
        TrustedDevice.token_hash == _sha256(device_token),
    ).first()
    return bool(device and device.expires_at > datetime.utcnow())


def _issue_code(user: User, purpose: str, db: Session) -> dict:
    """Replaces any pending code for this purpose, emails a new one, and returns
    the 'code required' response. Raises 503 if the email can't be sent."""
    db.query(EmailCode).filter(EmailCode.user_id == user.id, EmailCode.purpose == purpose).delete()
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(EmailCode(
        user_id=user.id, purpose=purpose, code_hash=_sha256(code),
        expires_at=datetime.utcnow() + timedelta(minutes=CODE_TTL_MINUTES),
    ))
    db.commit()
    if _DEV_MODE:
        print(f"[auth] DEV: {purpose} code for {user.email}: {code}", flush=True)
    try:
        sent = send_code_email(user.email, user.name, code, purpose)
    except Exception as e:
        print(f"[auth] failed to send {purpose} code to {user.email}: {type(e).__name__}: {e}", flush=True)
        sent = False
    if not sent and not _DEV_MODE:
        raise HTTPException(status_code=503, detail="Could not send the verification email. Please try again later.")
    return {"verification_required": True, "purpose": purpose, "email": user.email}


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
    user = db.query(User).filter(User.email == req.email).first()
    if user and user.email_verified:
        raise HTTPException(status_code=400, detail="Email already registered")
    if user:
        # Sign-up was started but never verified (e.g. a typo'd or abandoned
        # attempt) — let it be redone instead of locking the address forever.
        user.name = req.name
        user.password = hash_password(req.password)
    else:
        user = User(
            name=req.name,
            email=req.email,
            password=hash_password(req.password),
            email_verified=0,
        )
        db.add(user)
    db.commit()
    db.refresh(user)
    # No session until the emailed code is confirmed via /auth/verify-code.
    return _issue_code(user, "verify", db)


# ── POST /auth/login — verify credentials and return user ────────────────────
# 401 on wrong email or password (single generic message to avoid user enumeration).
@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Correct password, but the address was never confirmed — send a new
    # sign-up code instead of a session.
    if not user.email_verified:
        return _issue_code(user, "verify", db)
    # Browser not seen before (or trust expired) — confirm with an emailed code.
    if not _is_trusted_device(user, req.device_token, db):
        return _issue_code(user, "login", db)
    return _user_payload(user, db, req.remember)


# ── POST /auth/verify-code — confirm an emailed code, then log in ─────────────
# Completes sign-up ('verify') or a new-browser login ('login'). Success also
# trusts this browser for TRUSTED_DEVICE_DAYS. A code is burned after
# CODE_MAX_ATTEMPTS wrong guesses, so 6 digits can't be brute-forced.
@router.post("/verify-code")
def verify_code(req: VerifyCodeRequest, db: Session = Depends(get_db)):
    invalid = HTTPException(status_code=400, detail="Invalid or expired code")
    if req.purpose not in CODE_PURPOSES:
        raise invalid
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise invalid
    record = db.query(EmailCode).filter(EmailCode.user_id == user.id, EmailCode.purpose == req.purpose).first()
    if not record or record.expires_at < datetime.utcnow():
        raise invalid
    if not secrets.compare_digest(record.code_hash, _sha256(req.code.strip())):
        record.attempts += 1
        if record.attempts >= CODE_MAX_ATTEMPTS:
            db.delete(record)
            db.commit()
            raise HTTPException(status_code=400, detail="Too many wrong attempts. Request a new code.")
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect code")
    db.delete(record)
    if req.purpose == "verify":
        user.email_verified = 1
    db.commit()
    return _user_payload(user, db, req.remember, new_device=True)


# ── POST /auth/resend-code — email a fresh code ───────────────────────────────
# Only re-sends when a code for this purpose is already pending (i.e. sign-up
# or a correct-password login happened), so it can't be used to spam an
# address or to learn which emails are registered. Same reply either way.
@router.post("/resend-code")
def resend_code(req: ResendCodeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if user and req.purpose in CODE_PURPOSES:
        record = db.query(EmailCode).filter(EmailCode.user_id == user.id, EmailCode.purpose == req.purpose).first()
        if record:
            wait = CODE_RESEND_SECONDS - (datetime.utcnow() - record.created_at).total_seconds()
            if wait > 0:
                raise HTTPException(status_code=429, detail=f"Please wait {int(wait) + 1}s before requesting a new code.")
            _issue_code(user, req.purpose, db)
    return {"message": "If a code was pending, a new one has been sent."}


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

    # Google has verified this address, and Google sign-in is itself a strong
    # login — no emailed code needed; trust this browser for password logins too.
    if not user.email_verified:
        user.email_verified = 1
        db.query(EmailCode).filter(EmailCode.user_id == user.id).delete()
        db.commit()
    return _user_payload(user, db, req.remember, new_device=True)


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


# ── PUT /auth/upgrade/{user_id} — activate Premium on the account ────────────
# GENTEK has no real payment gateway integration — this marks the account
# Premium once the (currently UI-only) payment form is submitted. The backend
# is still the source of truth: is_premium is persisted here, not just set in
# frontend state, so it survives refresh/re-login and every other endpoint
# that reads is_premium (word limits, plan badges) picks it up immediately.
@router.put("/upgrade/{user_id}")
def upgrade_to_premium(user_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_premium = 1
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


# ── PUT /auth/upgrade/{user_id} — activate Premium ────────────────────────────
# GENTEK's checkout (PaymentModal.jsx) is a UI-only demo — no real payment
# gateway is wired up. This is what "Submit Payment" actually calls once the
# user completes that flow, so the account is genuinely marked Premium instead
# of just showing a success screen with no effect.
@router.put("/upgrade/{user_id}")
def upgrade_to_premium(user_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_premium = 1
    db.commit()
    return {"is_premium": bool(user.is_premium)}


# ── DELETE /auth/delete/{user_id} — permanently remove account ───────────────
# Cascades to all analyses owned by this user (see models.py relationship).
@router.delete("/delete/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for model in (EmailCode, TrustedDevice, PasswordResetToken):
        db.query(model).filter(model.user_id == user_id).delete()
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


# ── Email helpers — Gmail SMTP ────────────────────────────────────────────────
def _send_email(to_email: str, subject: str, html: str) -> bool:
    """Sends one HTML email. Returns False if SMTP isn't configured."""
    gmail_user     = os.getenv("GMAIL_USER", "").strip()
    gmail_password = os.getenv("GMAIL_APP_PASSWORD", "").strip()
    if not gmail_user or not gmail_password:
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = gmail_user
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as smtp:
        smtp.login(gmail_user, gmail_password)
        smtp.sendmail(gmail_user, to_email, msg.as_string())
    return True


def send_code_email(to_email: str, to_name: str, code: str, purpose: str) -> bool:
    if purpose == "verify":
        subject, heading, intro = ("Verify your GENTEK email", "Confirm your email",
                                   "Use this code to finish creating your GENTEK account.")
    else:
        subject, heading, intro = ("Your GENTEK sign-in code", "New sign-in",
                                   "Someone (hopefully you) signed in to GENTEK from a new browser. Use this code to continue.")
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:22px;font-weight:800;color:#0D9488">GENTEK</span>
      </div>
      <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">{heading}</h2>
      <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:20px">
        Hi {escape(to_name)}, {intro} It expires in <strong>{CODE_TTL_MINUTES} minutes</strong>.
      </p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#0D9488;text-align:center;
                  background:#F0FDFA;border-radius:12px;padding:16px 0;margin-bottom:20px">{code}</div>
      <p style="color:#999;font-size:12px">
        If you didn't try to {"sign up" if purpose == "verify" else "sign in"}, ignore this email{"" if purpose == "verify" else " and consider changing your password"}.
      </p>
    </div>
    """
    return _send_email(to_email, subject, html)


def send_reset_email(to_email: str, to_name: str, reset_url: str):

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

    _send_email(to_email, "Reset your GENTEK password", html)


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
        app_url   = os.getenv("APP_URL", "http://localhost:5173").strip()
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
