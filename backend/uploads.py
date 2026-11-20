# ── Upload quota routes ──────────────────────────────────────────────────────
# Free accounts may upload FREE_UPLOADS_PER_DAY files (PDF/Word/TXT) per day;
# Premium is unlimited; guests can't upload (they have no account to count on).
# The day resets at midnight Philippine time (UTC+8, no daylight saving).
#
# Files are read in the BROWSER (src/utils/documentText.js) and never reach
# this server. So the browser asks here before using an extracted file:
#   GET  /uploads/quota  → how many are left today (for the Upload button)
#   POST /uploads/claim  → called only after a file was read successfully, so a
#                          broken/empty file never uses up an upload. Refused
#                          with 429 once today's uploads are used.
# The count lives in the database (Upload rows), so a refresh, another
# browser or another device can't reset it.

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
from database import get_db
from models import User, Upload

router = APIRouter(prefix="/uploads", tags=["uploads"])

PH_OFFSET = timedelta(hours=8)


def free_limit() -> int:
    try:
        return max(0, int(os.getenv("FREE_UPLOADS_PER_DAY", "2")))
    except ValueError:
        return 2


def _day_bounds(now: Optional[datetime] = None) -> tuple:
    """(start, end) of today in Philippine time, as naive UTC datetimes."""
    now = now or datetime.utcnow()
    ph_midnight = datetime.combine((now + PH_OFFSET).date(), datetime.min.time())
    start = ph_midnight - PH_OFFSET
    return start, start + timedelta(days=1)


def _quota(user: User, db: Session) -> dict:
    start, end = _day_bounds()
    if user.premium_active:
        return {"limit": None, "used": None, "remaining": None, "resets_at": None}
    used = db.query(Upload).filter(Upload.user_id == user.id, Upload.created_at >= start).count()
    limit = free_limit()
    return {"limit": limit, "used": used, "remaining": max(0, limit - used),
            "resets_at": end.isoformat() + "Z"}


def _user(current_user: dict, db: Session) -> User:
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── GET /uploads/quota ───────────────────────────────────────────────────────
@router.get("/quota")
def upload_quota(db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    return _quota(_user(current_user, db), db)


class ClaimRequest(BaseModel):
    kind: str = ""        # 'pdf' | 'docx' | 'txt' — kept for the record only


# ── POST /uploads/claim — use one of today's uploads ─────────────────────────
@router.post("/claim")
def claim_upload(req: ClaimRequest, db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    user = _user(current_user, db)
    q = _quota(user, db)
    if q["limit"] is not None and q["remaining"] <= 0:
        raise HTTPException(status_code=429, detail={
            "message": f"You've used your {q['limit']} free uploads for today. "
                       "Upgrade to Premium for unlimited uploads, or paste the text instead.",
            **q,
        })
    db.add(Upload(user_id=user.id, kind=(req.kind or "")[:10]))
    db.commit()
    return _quota(user, db)
