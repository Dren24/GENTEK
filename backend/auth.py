# ── Auth & history routes ────────────────────────────────────────────────────
# All routes are prefixed with /auth (e.g. POST /auth/register).
# Passwords are hashed with bcrypt — never stored or returned in plain text.
# Protected routes require a valid JWT Bearer token (issued at login/register).

from fastapi import APIRouter, Depends, HTTPException, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import update, delete
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
import bcrypt
import hashlib
import secrets
import smtplib
import os
import requests
import threading
import time
from collections import defaultdict, deque
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


# ── Email OTP config ──────────────────────────────────────────────────────────
CODE_TTL_MINUTES       = 5
CODE_MAX_ATTEMPTS      = 5     # wrong guesses before the code is burned
CODE_RESEND_SECONDS    = 60
TRUSTED_DEVICE_DAYS    = 30
RESET_TOKEN_MINUTES    = 10    # window to choose a new password after a correct reset code
PENDING_SIGNUP_DAYS    = 7     # unverified sign-ups older than this are removed
# 'verify' = sign-up, 'login' = login from a new browser, 'reset' = forgot password
CODE_PURPOSES          = {"verify", "login", "reset"}
# Local dev (SQLite, no DATABASE_URL) also prints codes to the server log, so
# codes stay usable locally when Gmail isn't set up. Never in production:
# codes are only ever delivered by email there.
_DEV_MODE = not os.getenv("DATABASE_URL")
# The seeded local test account (see main.py) skips emailed codes — its
# address can't receive mail. Only in local dev; never with a real database.
DEV_TEST_EMAIL = "premiumtest@gentek.local"


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# ── Rate limiting ─────────────────────────────────────────────────────────────
# Sliding-window counters per email and per client IP, in process memory.
# GENTEK runs as a single instance on Render, so this covers every request;
# with several instances each would keep its own counts. Limits are on top of
# the per-code attempt cap and resend cooldown.
class _RateLimiter:
    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> Optional[int]:
        """Records one hit; returns seconds to wait if over the limit, else None."""
        now = time.time()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window_seconds:
                q.popleft()
            if len(q) >= limit:
                return int(q[0] + window_seconds - now) + 1
            q.append(now)
            return None

    def reset(self):
        with self._lock:
            self._hits.clear()


_limiter = _RateLimiter()
# (limit, window seconds)
_LIMITS = {
    "send:email":   (5, 30 * 60),    # code emails to one address
    "send:ip":      (20, 30 * 60),   # code emails triggered from one IP
    "verify:email": (15, 15 * 60),   # code guesses for one address (across codes)
    "verify:ip":    (40, 15 * 60),   # code guesses from one IP
    "login:ip":     (30, 15 * 60),   # password attempts from one IP
    "cooldown":     (1, CODE_RESEND_SECONDS),  # one code request per address+purpose
}


def _client_ip(request: Request) -> str:
    # Behind Render's proxy the client address is in X-Forwarded-For; the
    # right-most entry is the one the proxy itself appended.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit(kind: str, value: str):
    limit, window = _LIMITS[kind]
    wait = _limiter.hit(f"{kind}:{value.lower()}", limit, window)
    if wait is not None:
        if kind == "cooldown":
            raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting a new code.")
        raise HTTPException(status_code=429, detail=f"Too many attempts. Please try again in {max(1, round(wait / 60))} minute(s).")


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


def _cleanup_expired(db: Session):
    """Removes expired codes, reset tokens and device trusts, and sign-ups that
    were never verified within PENDING_SIGNUP_DAYS (they can't have history)."""
    now = datetime.utcnow()
    db.execute(delete(EmailCode).where(EmailCode.expires_at < now))
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.expires_at < now))
    db.execute(delete(TrustedDevice).where(TrustedDevice.expires_at < now))
    stale = [u.id for u in db.query(User.id).filter(
        User.email_verified == 0, User.created_at < now - timedelta(days=PENDING_SIGNUP_DAYS)).all()]
    if stale:
        for model in (EmailCode, TrustedDevice, PasswordResetToken):
            db.execute(delete(model).where(model.user_id.in_(stale)))
        db.execute(delete(User).where(User.id.in_(stale)))
    db.commit()


def _smtp_configured() -> bool:
    return bool(os.getenv("GMAIL_USER", "").strip() and os.getenv("GMAIL_APP_PASSWORD", "").strip())


def _issue_code(user: User, purpose: str, db: Session, ip: str) -> dict:
    """Replaces any pending code for this purpose (the old one stops working),
    emails a new one, and returns the 'code required' response. Raises 429 when
    rate-limited and 503 if the email can't be sent."""
    _rate_limit("send:email", user.email)
    _rate_limit("send:ip", ip)
    _cleanup_expired(db)
    # The old code (if any) stops working; "fetch" also drops it from this session.
    db.execute(delete(EmailCode).where(EmailCode.user_id == user.id, EmailCode.purpose == purpose)
               .execution_options(synchronize_session="fetch"))
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
        # Exception text from smtplib carries the server reply, never the
        # credentials; the code itself is not logged.
        print(f"[auth] failed to send {purpose} code to {user.email}: {type(e).__name__}: {e}", flush=True)
        sent = False
    # Locally, a missing Gmail setup is tolerated (the code is printed above);
    # a configured Gmail that fails is reported, so "sent" never lies.
    if not sent and not (_DEV_MODE and not _smtp_configured()):
        db.execute(delete(EmailCode).where(EmailCode.user_id == user.id, EmailCode.purpose == purpose))
        db.commit()
        raise HTTPException(status_code=503, detail="We couldn't send the verification email. Please try again in a few minutes.")
    return {"verification_required": True, "purpose": purpose, "email": user.email}


def _code_flow(user: User, purpose: str, db: Session, ip: str) -> dict:
    """For a sign-up or login: if a code for this purpose was sent less than
    CODE_RESEND_SECONDS ago and is still valid, reuse it (a double-click or a
    retried login shouldn't send another email); otherwise issue a new one."""
    pending = db.query(EmailCode).filter(EmailCode.user_id == user.id, EmailCode.purpose == purpose).first()
    now = datetime.utcnow()
    if (pending and pending.expires_at > now and pending.attempts < CODE_MAX_ATTEMPTS
            and (now - pending.created_at).total_seconds() < CODE_RESEND_SECONDS):
        return {"verification_required": True, "purpose": purpose, "email": user.email}
    return _issue_code(user, purpose, db, ip)


def _consume_code(user: User, purpose: str, code: str, db: Session, ip: str):
    """Checks an emailed code and, if right, deletes it so it can't be used
    again. Every step is a single conditional UPDATE/DELETE, so two requests
    racing with the same code can't both succeed and concurrent wrong guesses
    can't exceed CODE_MAX_ATTEMPTS. Raises 400/429 on failure."""
    _rate_limit("verify:email", user.email)
    _rate_limit("verify:ip", ip)
    invalid = HTTPException(status_code=400, detail="Invalid or expired code. Request a new one.")
    now = datetime.utcnow()
    record = db.query(EmailCode).filter(EmailCode.user_id == user.id, EmailCode.purpose == purpose).first()
    if not record or record.expires_at < now or record.attempts >= CODE_MAX_ATTEMPTS:
        raise invalid
    if secrets.compare_digest(record.code_hash, _sha256(code.strip())):
        consumed = db.execute(delete(EmailCode).where(
            EmailCode.id == record.id, EmailCode.attempts < CODE_MAX_ATTEMPTS)).rowcount
        db.commit()
        if consumed != 1:
            raise invalid  # another request used (or burned) it first
        return
    db.execute(update(EmailCode).where(EmailCode.id == record.id)
               .values(attempts=EmailCode.attempts + 1))
    db.commit()
    db.refresh(record)
    if record.attempts >= CODE_MAX_ATTEMPTS:
        db.execute(delete(EmailCode).where(EmailCode.id == record.id))
        db.commit()
        raise HTTPException(status_code=400, detail="Too many wrong attempts. Request a new code.")
    left = CODE_MAX_ATTEMPTS - record.attempts
    raise HTTPException(status_code=400, detail=f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left.")


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
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
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
    return _code_flow(user, "verify", db, _client_ip(request))


# ── POST /auth/login — verify credentials and return user ────────────────────
# 401 on wrong email or password (single generic message to avoid user enumeration).
@router.post("/login")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    _rate_limit("login:ip", ip)
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Correct password, but the address was never confirmed — send a new
    # sign-up code instead of a session.
    if _DEV_MODE and user.email == DEV_TEST_EMAIL:
        return _user_payload(user, db, req.remember)
    if not user.email_verified:
        return _code_flow(user, "verify", db, ip)
    # Browser not seen before (or trust expired) — confirm with an emailed code.
    if not _is_trusted_device(user, req.device_token, db):
        return _code_flow(user, "login", db, ip)
    return _user_payload(user, db, req.remember)


# ── POST /auth/verify-code — confirm an emailed code, then log in ─────────────
# Completes sign-up ('verify') or a new-browser login ('login'). Success also
# trusts this browser for TRUSTED_DEVICE_DAYS. Password-reset codes use
# /auth/verify-reset-code instead, which never logs in.
@router.post("/verify-code")
def verify_code(req: VerifyCodeRequest, request: Request, db: Session = Depends(get_db)):
    if req.purpose not in ("verify", "login"):
        raise HTTPException(status_code=400, detail="Invalid or expired code. Request a new one.")
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired code. Request a new one.")
    _consume_code(user, req.purpose, req.code, db, _client_ip(request))
    if req.purpose == "verify":
        user.email_verified = 1
        db.commit()
    return _user_payload(user, db, req.remember, new_device=True)


# ── POST /auth/resend-code — email a fresh code ───────────────────────────────
# Only re-sends when a code for this purpose is already pending (i.e. sign-up,
# a correct-password login, or a forgot-password request happened), so it
# can't be used to spam an address or learn which emails are registered: the
# cooldown applies and the reply is the same whether or not the email exists.
@router.post("/resend-code")
def resend_code(req: ResendCodeRequest, request: Request, db: Session = Depends(get_db)):
    if req.purpose not in CODE_PURPOSES:
        raise HTTPException(status_code=400, detail="Unknown code type")
    user = db.query(User).filter(User.email == req.email).first()
    pending = user and db.query(EmailCode).filter(EmailCode.user_id == user.id, EmailCode.purpose == req.purpose).first()
    if pending:
        # 60s since the current code was sent
        wait = CODE_RESEND_SECONDS - (datetime.utcnow() - pending.created_at).total_seconds()
        if wait > 0:
            raise HTTPException(status_code=429, detail=f"Please wait {int(wait) + 1}s before requesting a new code.")
    else:
        # No current code (or no such account): 60s between requests per address
        _rate_limit("cooldown", f"{req.purpose}:{req.email}")
    # A forgot-password code may have expired or been burned — still allow a
    # new one, since that flow starts from just an email.
    if user and (pending or req.purpose == "reset"):
        _issue_code(user, req.purpose, db, _client_ip(request))
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
def _send_email(to_email: str, subject: str, html: str, text: str = "") -> bool:
    """Sends one email over Gmail SMTP with TLS (port 465). Returns False if
    SMTP isn't configured; raises on delivery errors."""
    gmail_user     = os.getenv("GMAIL_USER", "").strip()
    gmail_password = os.getenv("GMAIL_APP_PASSWORD", "").strip()
    if not gmail_user or not gmail_password:
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"GENTEK <{gmail_user}>"
    msg["To"]      = to_email
    if text:
        msg.attach(MIMEText(text, "plain"))  # plain first, HTML preferred by clients
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as smtp:
        smtp.login(gmail_user, gmail_password)
        smtp.sendmail(gmail_user, to_email, msg.as_string())
    return True


_CODE_EMAILS = {
    "verify": ("Your GENTEK verification code", "Verify your email",
               "Use this code to finish creating your GENTEK account.",
               "If you didn't sign up for GENTEK, you can ignore this email."),
    "login":  ("Your GENTEK sign-in code", "Confirm it's you",
               "Someone signed in to your GENTEK account from a new browser. Use this code to continue.",
               "If this wasn't you, don't enter the code — change your GENTEK password."),
    "reset":  ("Your GENTEK password reset code", "Reset your password",
               "Use this code to reset your GENTEK password.",
               "If you didn't ask to reset your password, ignore this email — your password stays the same."),
}


def send_code_email(to_email: str, to_name: str, code: str, purpose: str) -> bool:
    subject, heading, intro, ignore = _CODE_EMAILS[purpose]
    html = f"""
    <div style="background:#F8FAFC;padding:32px 12px;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;padding:32px 28px">
        <div style="text-align:center;margin-bottom:24px">
          <span style="font-size:22px;font-weight:800;color:#111827">GEN</span><span style="font-size:22px;font-weight:800;color:#0D9488">TEK</span>
        </div>
        <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px">{heading}</h2>
        <p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0 0 20px">
          Hi {escape(to_name)}, {intro}
        </p>
        <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0D9488;text-align:center;
                    background:#F0FDFA;border:1px solid #CCFBF1;border-radius:12px;padding:16px 0;margin-bottom:16px">{code}</div>
        <p style="color:#4B5563;font-size:13px;line-height:1.6;margin:0 0 16px;text-align:center">
          This code expires in <strong>{CODE_TTL_MINUTES} minutes</strong> and can be used once.
        </p>
        <p style="color:#9A3412;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;font-size:12px;line-height:1.5;padding:10px 12px;margin:0 0 16px">
          <strong>Never share this code.</strong> GENTEK will never ask you for it by phone, chat, or email.
        </p>
        <p style="color:#9CA3AF;font-size:12px;line-height:1.5;margin:0">{ignore}</p>
      </div>
    </div>
    """
    text = (f"Hi {to_name}, {intro}\n\nYour code: {code}\n\nIt expires in {CODE_TTL_MINUTES} minutes and can be used once. "
            f"Never share this code.\n\n{ignore}\n\n— GENTEK")
    return _send_email(to_email, subject, html, text)


# ── POST /auth/forgot-password — email a password-reset code ──────────────────
# Same reply whether or not the email is registered (no account enumeration);
# the 60s cooldown also applies to unknown emails for the same reason.
class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    email = req.email.strip()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if not _smtp_configured() and not _DEV_MODE:
        raise HTTPException(status_code=503, detail="We couldn't send the verification email. Please try again in a few minutes.")
    reply = {"message": "If that email is registered, a 6-digit code has been sent.", "email": email}
    # Within the cooldown (e.g. a double-click), go on to the code step without
    # sending again — known or unknown email alike.
    limit, window = _LIMITS["cooldown"]
    if _limiter.hit(f"cooldown:reset:{email.lower()}", limit, window) is not None:
        return reply
    user = db.query(User).filter(User.email == email).first()
    if user:
        _issue_code(user, "reset", db, _client_ip(request))
    return reply


# ── POST /auth/verify-reset-code — trade a correct code for a reset token ─────
# The token is the backend's own proof that the inbox was verified: random,
# stored only as a hash, valid for RESET_TOKEN_MINUTES, usable once. The new
# password is only accepted with it — never on frontend state alone.
class VerifyResetCodeRequest(BaseModel):
    email: str
    code: str


@router.post("/verify-reset-code")
def verify_reset_code(req: VerifyResetCodeRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip()).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired code. Request a new one.")
    _consume_code(user, "reset", req.code, db, _client_ip(request))
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(user_id=user.id, token=_sha256(token),
                              expires_at=datetime.utcnow() + timedelta(minutes=RESET_TOKEN_MINUTES)))
    db.commit()
    return {"reset_token": token, "expires_in_minutes": RESET_TOKEN_MINUTES}


# ── POST /auth/reset-password — set a new password with a reset token ─────────
class ResetPasswordRequest(BaseModel):
    token:        str   # issued by /auth/verify-reset-code
    new_password: str


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    invalid = HTTPException(status_code=400, detail="This reset session has expired. Please request a new code.")
    record = db.query(PasswordResetToken).filter(PasswordResetToken.token == _sha256(req.token)).first()
    if not record or record.expires_at < datetime.utcnow():
        raise invalid
    # Consume first, atomically — a token racing with itself succeeds once.
    if db.execute(delete(PasswordResetToken).where(PasswordResetToken.id == record.id)).rowcount != 1:
        db.rollback()
        raise invalid
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        db.commit()
        raise invalid
    user.password = hash_password(req.new_password)
    # Proving the inbox also confirms the address; the password changed, so
    # browsers trusted under the old one must confirm again.
    user.email_verified = 1
    db.execute(delete(TrustedDevice).where(TrustedDevice.user_id == user.id))
    db.execute(delete(EmailCode).where(EmailCode.user_id == user.id))
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
