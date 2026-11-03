"""Tests for email verification: sign-up codes, new-browser login codes,
trusted devices, resend limits. Uses a throwaway SQLite file and captures
emails instead of sending them.

Run: python3 -m unittest test_auth -v   (from backend/)
"""
import os
import re
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest import mock

_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"   # also turns off DEV code logging

from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
import main  # noqa: E402
from database import SessionLocal  # noqa: E402
from models import EmailCode, User  # noqa: E402

_REAL_SEND_CODE = auth.send_code_email


class EmailVerificationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.sent = []  # (to, code, purpose)
        mock.patch.object(auth, "send_code_email",
                          side_effect=lambda to, name, code, purpose: self.sent.append((to, code, purpose)) or True).start()
        db = SessionLocal()
        for model in (EmailCode, auth.TrustedDevice, User):
            db.query(model).delete()
        db.commit()
        db.close()

    def tearDown(self):
        mock.patch.stopall()

    def last_code(self):
        return self.sent[-1][1]

    def signup(self, email="ana@example.com", password="secret123"):
        return self.client.post("/auth/register", json={"name": "Ana", "email": email, "password": password})

    def verify(self, code, purpose="verify", email="ana@example.com"):
        return self.client.post("/auth/verify-code", json={"email": email, "code": code, "purpose": purpose})

    def login(self, device_token=None, password="secret123"):
        return self.client.post("/auth/login", json={"email": "ana@example.com", "password": password,
                                                     "device_token": device_token})

    def signed_up_device(self):
        self.signup()
        return self.verify(self.last_code()).json()["device_token"]

    # ── Sign-up ────────────────────────────────────────────────────────────────
    def test_signup_sends_code_and_gives_no_session(self):
        r = self.signup()
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body, {"verification_required": True, "purpose": "verify", "email": "ana@example.com"})
        self.assertNotIn("token", body)
        self.assertRegex(self.last_code(), r"^\d{6}$")

    def test_correct_code_verifies_and_logs_in(self):
        self.signup()
        r = self.verify(self.last_code())
        self.assertEqual(r.status_code, 200)
        self.assertIn("token", r.json())
        self.assertIn("device_token", r.json())
        db = SessionLocal()
        self.assertEqual(db.query(User).filter_by(email="ana@example.com").one().email_verified, 1)
        db.close()

    def test_code_is_single_use(self):
        self.signup()
        code = self.last_code()
        self.assertEqual(self.verify(code).status_code, 200)
        self.assertEqual(self.verify(code).status_code, 400)

    def test_wrong_code_burns_after_max_attempts(self):
        self.signup()
        code = self.last_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(auth.CODE_MAX_ATTEMPTS - 1):
            self.assertEqual(self.verify(wrong).json()["detail"], "Incorrect code")
        self.assertIn("Too many", self.verify(wrong).json()["detail"])
        self.assertEqual(self.verify(code).status_code, 400)  # even the right code is gone now

    def test_expired_code_is_rejected(self):
        self.signup()
        db = SessionLocal()
        db.query(EmailCode).update({EmailCode.expires_at: datetime.utcnow() - timedelta(seconds=1)})
        db.commit()
        db.close()
        self.assertEqual(self.verify(self.last_code()).status_code, 400)

    def test_unverified_signup_can_be_redone_but_verified_cannot(self):
        self.signup()
        self.assertEqual(self.signup(password="newpass1").status_code, 200)  # still unverified
        self.verify(self.last_code())
        self.assertEqual(self.signup().status_code, 400)

    def test_login_before_verifying_resends_signup_code(self):
        self.signup()
        r = self.login()
        self.assertEqual(r.json()["purpose"], "verify")
        self.assertNotIn("token", r.json())

    # ── Login on new vs trusted browser ────────────────────────────────────────
    def test_trusted_browser_logs_in_without_code(self):
        device = self.signed_up_device()
        before = len(self.sent)
        r = self.login(device_token=device)
        self.assertIn("token", r.json())
        self.assertEqual(len(self.sent), before)

    def test_new_browser_needs_login_code(self):
        self.signed_up_device()
        r = self.login(device_token=None)
        self.assertEqual(r.json()["purpose"], "login")
        self.assertNotIn("token", r.json())
        r = self.verify(self.last_code(), purpose="login")
        self.assertIn("token", r.json())
        self.assertIn("device_token", r.json())

    def test_expired_trust_needs_code_again(self):
        device = self.signed_up_device()
        db = SessionLocal()
        db.query(auth.TrustedDevice).update({auth.TrustedDevice.expires_at: datetime.utcnow() - timedelta(seconds=1)})
        db.commit()
        db.close()
        self.assertEqual(self.login(device_token=device).json()["purpose"], "login")

    def test_wrong_password_sends_no_code(self):
        self.signed_up_device()
        before = len(self.sent)
        self.assertEqual(self.login(password="wrong").status_code, 401)
        self.assertEqual(len(self.sent), before)

    def test_device_token_of_another_user_is_not_trusted(self):
        other = self.signed_up_device()
        self.signup(email="ben@example.com")
        self.verify(self.last_code(), email="ben@example.com")
        r = self.client.post("/auth/login", json={"email": "ben@example.com", "password": "secret123",
                                                  "device_token": other})
        self.assertEqual(r.json()["purpose"], "login")

    # ── Resend ─────────────────────────────────────────────────────────────────
    def test_resend_requires_cooldown_and_pending_code(self):
        self.signup()
        self.assertEqual(self.client.post("/auth/resend-code", json={"email": "ana@example.com", "purpose": "verify"}).status_code, 429)
        db = SessionLocal()
        db.query(EmailCode).update({EmailCode.created_at: datetime.utcnow() - timedelta(seconds=auth.CODE_RESEND_SECONDS + 1)})
        db.commit()
        db.close()
        old = self.last_code()
        before = len(self.sent)
        self.assertEqual(self.client.post("/auth/resend-code", json={"email": "ana@example.com", "purpose": "verify"}).status_code, 200)
        self.assertEqual(len(self.sent), before + 1)
        if self.last_code() != old:
            self.assertEqual(self.verify(old).status_code, 400)  # old code replaced

    def test_resend_without_pending_code_sends_nothing(self):
        before = len(self.sent)
        r = self.client.post("/auth/resend-code", json={"email": "nobody@example.com", "purpose": "verify"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(self.sent), before)

    def test_email_failure_in_production_is_reported(self):
        auth.send_code_email.side_effect = lambda *a: False
        r = self.signup()
        self.assertEqual(r.status_code, 503)

    def test_code_email_contains_code_and_escapes_name(self):
        captured = {}
        with mock.patch.object(auth, "_send_email",
                               side_effect=lambda to, subj, html: captured.update(subj=subj, html=html) or True):
            _REAL_SEND_CODE("ana@example.com", "<Ana>", "123456", "login")
        self.assertIn("123456", captured["html"])
        self.assertIn("&lt;Ana&gt;", captured["html"])
        self.assertEqual(captured["subj"], "Your GENTEK sign-in code")

if __name__ == "__main__":
    unittest.main()
