"""Test-account helper for the Playwright evidence tests (e2e/).

Works on Mac and Windows (uses Python, not the sqlite3 command).
  python e2e/test_account.py ensure          -> creates the local test account if missing
  python e2e/test_account.py trust <token>   -> marks a browser as trusted (skips the emailed code)

Safety: only runs against the LOCAL SQLite database. If backend/.env points
DATABASE_URL at Neon (the live site), it refuses, so tests never touch real users.
"""
import hashlib
import os
import sys
from datetime import datetime, timedelta

BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(BACKEND)
sys.path.insert(0, BACKEND)

from dotenv import load_dotenv  # noqa: E402
load_dotenv()
url = os.getenv("DATABASE_URL", "sqlite:///./gentek.db").strip()
if not url.startswith("sqlite"):
    sys.exit("Refusing to run: DATABASE_URL is not the local SQLite database. "
             "Remove DATABASE_URL from backend/.env to test locally.")

import bcrypt  # noqa: E402
from database import SessionLocal, engine, Base  # noqa: E402
from models import User, TrustedDevice  # noqa: E402

EMAIL, PASSWORD, NAME = "premiumtest@gentek.local", "PremiumTest123!", "[DEV TEST] Premium Account"


def ensure(db):
    user = db.query(User).filter(User.email == EMAIL).first()
    if not user:
        user = User(name=NAME, email=EMAIL, email_verified=1,
                    password=bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode())
        db.add(user)
    user.is_premium, user.premium_until, user.premium_cancelled = 1, None, 0
    db.commit()
    return user


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    user = ensure(db)
    if len(sys.argv) > 2 and sys.argv[1] == "trust":
        db.add(TrustedDevice(user_id=user.id, token_hash=hashlib.sha256(sys.argv[2].encode()).hexdigest(),
                             expires_at=datetime.utcnow() + timedelta(days=1), created_at=datetime.utcnow()))
        db.commit()
    db.close()
    print("ok")
