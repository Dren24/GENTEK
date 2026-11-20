"""Tests for the Free plan's daily upload limit (backend/uploads.py).

Run: python3 -m unittest test_uploads -v   (from backend/)
"""
import os
import tempfile
import unittest
from datetime import datetime, timedelta

_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"

from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
import main  # noqa: E402
import uploads  # noqa: E402
from database import SessionLocal  # noqa: E402
from models import Upload, User  # noqa: E402


class UploadQuotaTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("FREE_UPLOADS_PER_DAY", None)
        self.client = TestClient(main.app)
        db = SessionLocal()
        db.query(Upload).delete()
        db.query(User).delete()
        free = User(name="Free", email="free@example.com", password="x")
        prem = User(name="Prem", email="prem@example.com", password="x", is_premium=1,
                    premium_until=datetime.utcnow() + timedelta(days=10))
        db.add_all([free, prem]); db.commit()
        self.free, self.prem = free.id, prem.id
        db.close()

    def h(self, uid):
        return {"Authorization": f"Bearer {auth._create_token(uid, 'x', 'x@example.com')}"}

    def claim(self, uid):
        return self.client.post("/uploads/claim", json={"kind": "pdf"}, headers=self.h(uid))

    def test_guests_cannot_upload(self):
        self.assertIn(self.client.post("/uploads/claim", json={}).status_code, (401, 403))
        self.assertIn(self.client.get("/uploads/quota").status_code, (401, 403))

    def test_free_gets_two_per_day(self):
        q = self.client.get("/uploads/quota", headers=self.h(self.free)).json()
        self.assertEqual((q["limit"], q["used"], q["remaining"]), (2, 0, 2))
        self.assertEqual(self.claim(self.free).json()["remaining"], 1)
        self.assertEqual(self.claim(self.free).json()["remaining"], 0)
        res = self.claim(self.free)
        self.assertEqual(res.status_code, 429)
        self.assertIn("Premium", res.json()["detail"]["message"])
        db = SessionLocal()
        self.assertEqual(db.query(Upload).filter(Upload.user_id == self.free).count(), 2)  # refused one not stored
        db.close()

    def test_yesterday_does_not_count(self):
        start, _ = uploads._day_bounds()
        db = SessionLocal()
        db.add_all([Upload(user_id=self.free, created_at=start - timedelta(minutes=1)) for _ in range(5)])
        db.commit(); db.close()
        self.assertEqual(self.client.get("/uploads/quota", headers=self.h(self.free)).json()["remaining"], 2)

    def test_day_resets_at_midnight_philippine_time(self):
        # 15:59 UTC = 23:59 in Manila → still Nov 20; 16:00 UTC = 00:00 Nov 21
        before = uploads._day_bounds(datetime(2026, 11, 20, 15, 59))
        after = uploads._day_bounds(datetime(2026, 11, 20, 16, 0))
        self.assertEqual(before[0], datetime(2026, 11, 19, 16, 0))
        self.assertEqual(after[0], datetime(2026, 11, 20, 16, 0))

    def test_premium_is_unlimited(self):
        for _ in range(5):
            res = self.claim(self.prem)
            self.assertEqual(res.status_code, 200)
            self.assertIsNone(res.json()["limit"])

    def test_expired_premium_gets_free_limit(self):
        db = SessionLocal()
        db.query(User).filter(User.id == self.prem).update({User.premium_until: datetime.utcnow() - timedelta(hours=1)})
        db.commit(); db.close()
        self.claim(self.prem); self.claim(self.prem)
        self.assertEqual(self.claim(self.prem).status_code, 429)

    def test_limit_is_configurable(self):
        os.environ["FREE_UPLOADS_PER_DAY"] = "1"
        self.claim(self.free)
        self.assertEqual(self.claim(self.free).status_code, 429)

    def test_deleting_account_removes_upload_records(self):
        self.claim(self.free)
        self.assertEqual(self.client.delete(f"/auth/delete/{self.free}", headers=self.h(self.free)).status_code, 200)
        db = SessionLocal()
        self.assertEqual(db.query(Upload).filter(Upload.user_id == self.free).count(), 0)
        db.close()


if __name__ == "__main__":
    unittest.main()
