"""Tests for email OTP flows: sign-up verification, new-browser login codes,
forgot-password reset, trusted devices, resend gaps, rate limits, single use
and cleanup. Uses a throwaway SQLite file and captures emails instead of
sending them (real Gmail delivery is checked separately).

Run: python3 -m unittest test_auth -v   (from backend/)
"""
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest import mock

_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"   # production-like: no DEV code logging

from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
import main  # noqa: E402
from database import SessionLocal  # noqa: E402
from models import EmailCode, PasswordResetToken, TrustedDevice, User  # noqa: E402

_REAL_SEND_CODE = auth.send_code_email
EMAIL = "ana@example.com"
PW = "secret123"


class OTPTestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.sent = []  # (to, code, purpose)
        self.send_mock = mock.patch.object(
            auth, "send_code_email",
            side_effect=lambda to, name, code, purpose: self.sent.append((to, code, purpose)) or True).start()
        auth._limiter.reset()
        db = SessionLocal()
        for model in (EmailCode, TrustedDevice, PasswordResetToken, User):
            db.query(model).delete()
        db.commit()
        db.close()

    def tearDown(self):
        mock.patch.stopall()

    # ── helpers ────────────────────────────────────────────────────────────────
    def last_code(self, purpose=None):
        return [c for _, c, p in self.sent if purpose in (None, p)][-1]

    def db_update(self, model, **values):
        db = SessionLocal()
        db.query(model).update({getattr(model, k): v for k, v in values.items()})
        db.commit()
        db.close()

    def age_codes(self, seconds):
        self.db_update(EmailCode, created_at=datetime.utcnow() - timedelta(seconds=seconds))

    def signup(self, email=EMAIL, password=PW, name="Ana"):
        return self.client.post("/auth/register", json={"name": name, "email": email, "password": password})

    def verify(self, code, purpose="verify", email=EMAIL):
        return self.client.post("/auth/verify-code", json={"email": email, "code": code, "purpose": purpose})

    def login(self, device_token=None, password=PW, email=EMAIL):
        return self.client.post("/auth/login", json={"email": email, "password": password, "device_token": device_token})

    def forgot(self, email=EMAIL):
        return self.client.post("/auth/forgot-password", json={"email": email})

    def verify_reset(self, code, email=EMAIL):
        return self.client.post("/auth/verify-reset-code", json={"email": email, "code": code})

    def reset(self, token, password="newpass456"):
        return self.client.post("/auth/reset-password", json={"token": token, "new_password": password})

    def verified_user(self, email=EMAIL):
        self.signup(email=email)
        return self.verify(self.last_code("verify"), email=email).json()["device_token"]

    def wrong(self, code):
        return "000000" if code != "000000" else "111111"


class SignUpTests(OTPTestCase):
    def test_signup_sends_code_and_gives_no_session(self):
        r = self.signup()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"verification_required": True, "purpose": "verify", "email": EMAIL})
        self.assertRegex(self.last_code(), r"^\d{6}$")
        db = SessionLocal()
        stored = db.query(EmailCode).one()
        self.assertNotEqual(stored.code_hash, self.last_code())       # only a hash is stored
        self.assertEqual(len(stored.code_hash), 64)
        self.assertAlmostEqual((stored.expires_at - datetime.utcnow()).total_seconds(), 300, delta=5)
        db.close()

    def test_correct_code_verifies_and_logs_in(self):
        self.signup()
        r = self.verify(self.last_code())
        self.assertEqual(r.status_code, 200)
        self.assertIn("token", r.json())
        db = SessionLocal()
        self.assertEqual(db.query(User).filter_by(email=EMAIL).one().email_verified, 1)
        db.close()

    def test_code_is_single_use(self):
        self.signup()
        code = self.last_code()
        self.assertEqual(self.verify(code).status_code, 200)
        self.assertEqual(self.verify(code).status_code, 400)

    def test_wrong_code_reports_attempts_left_then_burns(self):
        self.signup()
        code = self.last_code()
        self.assertEqual(self.verify(self.wrong(code)).json()["detail"], "Incorrect code. 4 attempts left.")
        for _ in range(auth.CODE_MAX_ATTEMPTS - 2):
            self.verify(self.wrong(code))
        self.assertIn("Too many", self.verify(self.wrong(code)).json()["detail"])
        self.assertEqual(self.verify(code).status_code, 400)  # the right code is gone too

    def test_expired_code_is_rejected(self):
        self.signup()
        self.db_update(EmailCode, expires_at=datetime.utcnow() - timedelta(seconds=1))
        r = self.verify(self.last_code())
        self.assertEqual(r.status_code, 400)
        self.assertIn("expired", r.json()["detail"])

    def test_duplicate_verified_email_is_rejected(self):
        self.verified_user()
        r = self.signup()
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["detail"], "Email already registered")

    def test_unverified_signup_can_be_redone(self):
        self.signup()
        self.age_codes(61)
        self.assertEqual(self.signup(password="other789").status_code, 200)
        self.verify(self.last_code())
        self.assertEqual(self.login(password="other789").status_code, 200)

    def test_double_click_does_not_send_twice(self):
        self.signup()
        self.signup()
        self.assertEqual(len(self.sent), 1)

    def test_login_before_verifying_gives_no_session(self):
        self.signup()
        r = self.login()
        self.assertEqual(r.json()["purpose"], "verify")
        self.assertNotIn("token", r.json())

    def test_login_code_cannot_verify_signup(self):
        self.signup()
        self.assertEqual(self.verify(self.last_code(), purpose="login").status_code, 400)

    def test_email_failure_reports_503_and_leaves_no_usable_code(self):
        self.send_mock.side_effect = lambda *a: False
        r = self.signup()
        self.assertEqual(r.status_code, 503)
        self.assertIn("couldn't send", r.json()["detail"])
        db = SessionLocal()
        self.assertEqual(db.query(EmailCode).count(), 0)
        db.close()

    def test_dev_mode_reports_failed_send_when_gmail_is_configured(self):
        self.send_mock.side_effect = lambda *a: False
        with mock.patch.object(auth, "_DEV_MODE", True):
            with mock.patch.object(auth, "_smtp_configured", return_value=True):
                self.assertEqual(self.signup().status_code, 503)
            with mock.patch.object(auth, "_smtp_configured", return_value=False):
                self.assertEqual(self.signup(email="local@example.com").status_code, 200)

    def test_smtp_exception_reports_503(self):
        def boom(*a):
            raise OSError("connection refused")
        self.send_mock.side_effect = boom
        self.assertEqual(self.signup().status_code, 503)

    def test_blank_name_rejected(self):
        self.assertEqual(self.signup(name="  ").status_code, 400)


class LoginDeviceTests(OTPTestCase):
    def test_trusted_browser_logs_in_without_code(self):
        device = self.verified_user()
        before = len(self.sent)
        self.assertIn("token", self.login(device_token=device).json())
        self.assertEqual(len(self.sent), before)

    def test_new_browser_needs_login_code(self):
        self.verified_user()
        r = self.login()
        self.assertEqual(r.json()["purpose"], "login")
        self.assertIn("token", self.verify(self.last_code("login"), purpose="login").json())

    def test_wrong_password_sends_no_code(self):
        self.verified_user()
        before = len(self.sent)
        self.assertEqual(self.login(password="wrong").status_code, 401)
        self.assertEqual(len(self.sent), before)

    def test_device_token_of_another_user_is_not_trusted(self):
        other = self.verified_user()
        self.verified_user(email="ben@example.com")
        self.assertEqual(self.login(email="ben@example.com", device_token=other).json()["purpose"], "login")


class ForgotPasswordTests(OTPTestCase):
    def test_full_reset_flow(self):
        self.verified_user()
        r = self.forgot()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.sent[-1][2], "reset")
        r = self.verify_reset(self.last_code("reset"))
        self.assertEqual(r.status_code, 200)
        token = r.json()["reset_token"]
        self.assertNotIn("token", r.json())          # a reset code never logs in
        self.assertEqual(self.reset(token).status_code, 200)
        self.assertEqual(self.login(password=PW).status_code, 401)            # old password dead
        self.assertEqual(self.login(password="newpass456").status_code, 200)  # new one works
        db = SessionLocal()
        self.assertNotEqual(db.query(PasswordResetToken).count(), 1)
        db.close()

    def test_unregistered_email_gets_same_reply_and_no_email(self):
        known, unknown = self.verified_user(), None
        before = len(self.sent)
        r_unknown = self.forgot(email="nobody@example.com")
        r_known = self.forgot()
        self.assertEqual(r_unknown.status_code, r_known.status_code)
        self.assertEqual(r_unknown.json()["message"], r_known.json()["message"])
        self.assertEqual(len(self.sent), before + 1)  # only the registered address got mail

    def test_wrong_and_expired_reset_codes(self):
        self.verified_user()
        self.forgot()
        code = self.last_code("reset")
        self.assertEqual(self.verify_reset(self.wrong(code)).status_code, 400)
        self.db_update(EmailCode, expires_at=datetime.utcnow() - timedelta(seconds=1))
        self.assertEqual(self.verify_reset(code).status_code, 400)

    def test_reset_code_and_token_are_single_use(self):
        self.verified_user()
        self.forgot()
        code = self.last_code("reset")
        token = self.verify_reset(code).json()["reset_token"]
        self.assertEqual(self.verify_reset(code).status_code, 400)
        self.assertEqual(self.reset(token).status_code, 200)
        self.assertEqual(self.reset(token, "another999").status_code, 400)

    def test_expired_reset_token_is_rejected(self):
        self.verified_user()
        self.forgot()
        token = self.verify_reset(self.last_code("reset")).json()["reset_token"]
        self.db_update(PasswordResetToken, expires_at=datetime.utcnow() - timedelta(seconds=1))
        self.assertEqual(self.reset(token).status_code, 400)
        self.assertEqual(self.login(password=PW).status_code, 200)  # password unchanged

    def test_made_up_token_cannot_reset(self):
        self.verified_user()
        self.assertEqual(self.reset("not-a-real-token").status_code, 400)

    def test_reset_code_cannot_log_in_and_signup_code_cannot_reset(self):
        self.verified_user()
        self.forgot()
        self.assertEqual(self.verify(self.last_code("reset"), purpose="reset").status_code, 400)
        self.signup(email="cy@example.com")
        self.assertEqual(self.verify_reset(self.last_code("verify"), email="cy@example.com").status_code, 400)

    def test_reset_revokes_trusted_browsers(self):
        device = self.verified_user()
        self.forgot()
        token = self.verify_reset(self.last_code("reset")).json()["reset_token"]
        self.reset(token)
        self.assertEqual(self.login(password="newpass456", device_token=device).json()["purpose"], "login")

    def test_reset_verifies_an_unverified_account(self):
        self.signup()
        self.forgot()
        token = self.verify_reset(self.last_code("reset")).json()["reset_token"]
        self.reset(token)
        db = SessionLocal()
        self.assertEqual(db.query(User).filter_by(email=EMAIL).one().email_verified, 1)
        db.close()

    def test_short_new_password_rejected_without_consuming_token(self):
        self.verified_user()
        self.forgot()
        token = self.verify_reset(self.last_code("reset")).json()["reset_token"]
        self.assertEqual(self.reset(token, "123").status_code, 400)
        self.assertEqual(self.reset(token).status_code, 200)

    def test_resend_reset_code_replaces_old(self):
        self.verified_user()
        self.forgot()
        old = self.last_code("reset")
        self.assertEqual(self.client.post("/auth/resend-code", json={"email": EMAIL, "purpose": "reset"}).status_code, 429)
        self.age_codes(61)
        auth._limiter.reset()
        self.assertEqual(self.client.post("/auth/resend-code", json={"email": EMAIL, "purpose": "reset"}).status_code, 200)
        new = self.last_code("reset")
        if new != old:
            self.assertEqual(self.verify_reset(old).status_code, 400)
        self.assertEqual(self.verify_reset(new).status_code, 200)

    def test_smtp_not_configured_in_production_is_503(self):
        with mock.patch.object(auth, "_smtp_configured", return_value=False):
            self.assertEqual(self.forgot().status_code, 503)


class ResendAndLimitTests(OTPTestCase):
    def test_resend_requires_gap(self):
        self.signup()
        r = self.client.post("/auth/resend-code", json={"email": EMAIL, "purpose": "verify"})
        self.assertEqual(r.status_code, 429)
        self.age_codes(61)
        self.assertEqual(self.client.post("/auth/resend-code", json={"email": EMAIL, "purpose": "verify"}).status_code, 200)
        self.assertEqual(len(self.sent), 2)

    def test_resend_without_pending_code_sends_nothing(self):
        r = self.client.post("/auth/resend-code", json={"email": "nobody@example.com", "purpose": "verify"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.sent, [])

    def test_send_limit_per_email(self):
        self.signup()
        limit = auth._LIMITS["send:email"][0]
        for _ in range(limit - 1):
            self.age_codes(61)
            auth._limiter._hits.pop(f"cooldown:verify:{EMAIL}", None)
            self.assertEqual(self.client.post("/auth/resend-code", json={"email": EMAIL, "purpose": "verify"}).status_code, 200)
        self.age_codes(61)
        r = self.client.post("/auth/resend-code", json={"email": EMAIL, "purpose": "verify"})
        self.assertEqual(r.status_code, 429)
        self.assertIn("Too many", r.json()["detail"])
        self.assertEqual(len(self.sent), limit)

    def test_verify_guess_limit_per_email_spans_codes(self):
        self.signup()
        limit = auth._LIMITS["verify:email"][0]
        for i in range(limit):
            if i and i % (auth.CODE_MAX_ATTEMPTS) == 0:   # code burned: get a new one
                self.age_codes(61)
                self.client.post("/auth/resend-code", json={"email": EMAIL, "purpose": "verify"})
            self.verify(self.wrong(self.last_code()))
        r = self.verify(self.last_code())
        self.assertEqual(r.status_code, 429)

    def test_login_limit_per_ip(self):
        self.verified_user()
        for _ in range(auth._LIMITS["login:ip"][0]):
            self.login(password="wrong")
        self.assertEqual(self.login(password="wrong").status_code, 429)

    def test_ip_taken_from_proxy_header(self):
        req = mock.Mock(headers={"x-forwarded-for": "1.1.1.1, 203.0.113.9"}, client=mock.Mock(host="10.0.0.1"))
        self.assertEqual(auth._client_ip(req), "203.0.113.9")


class SafetyTests(OTPTestCase):
    def test_burned_code_cannot_be_consumed_even_if_correct(self):
        self.signup()
        self.db_update(EmailCode, attempts=auth.CODE_MAX_ATTEMPTS)
        self.assertEqual(self.verify(self.last_code()).status_code, 400)

    def test_consume_is_atomic(self):
        # Simulate a second request that already consumed the row between our
        # read and our delete: the conditional delete must then fail.
        self.signup()
        code = self.last_code()
        db = SessionLocal()
        user = db.query(User).filter_by(email=EMAIL).one()
        real_execute = db.execute
        calls = {"n": 0}

        def racing_execute(stmt, *a, **k):
            if calls["n"] == 0 and "DELETE" in str(stmt):
                calls["n"] += 1
                other = SessionLocal()
                other.query(EmailCode).delete()
                other.commit()
                other.close()
            return real_execute(stmt, *a, **k)
        with mock.patch.object(db, "execute", side_effect=racing_execute):
            with self.assertRaises(auth.HTTPException) as cm:
                auth._consume_code(user, "verify", code, db, "1.2.3.4")
        self.assertEqual(cm.exception.status_code, 400)
        db.close()

    def test_cleanup_removes_expired_records_and_stale_signups(self):
        self.signup(email="old@example.com")
        self.db_update(EmailCode, expires_at=datetime.utcnow() - timedelta(minutes=1))
        db = SessionLocal()
        db.query(User).filter_by(email="old@example.com").update(
            {User.created_at: datetime.utcnow() - timedelta(days=auth.PENDING_SIGNUP_DAYS + 1)})
        db.commit()
        auth._cleanup_expired(db)
        self.assertEqual(db.query(EmailCode).count(), 0)
        self.assertIsNone(db.query(User).filter_by(email="old@example.com").first())
        db.close()

    def test_cleanup_keeps_old_verified_accounts(self):
        self.verified_user()
        db = SessionLocal()
        db.query(User).update({User.created_at: datetime.utcnow() - timedelta(days=400)})
        db.commit()
        auth._cleanup_expired(db)
        self.assertIsNotNone(db.query(User).filter_by(email=EMAIL).first())
        db.close()

    def test_api_responses_never_contain_the_code(self):
        r = self.signup()
        self.assertNotIn(self.last_code(), r.text)
        self.verified_user(email="dee@example.com")
        r = self.forgot(email="dee@example.com")
        self.assertNotIn(self.last_code("reset"), r.text)

    def test_dev_test_account_bypass_only_in_dev_mode(self):
        db = SessionLocal()
        db.add(User(name="Dev", email=auth.DEV_TEST_EMAIL, password=auth.hash_password("pw123456")))
        db.commit()
        db.close()
        body = {"email": auth.DEV_TEST_EMAIL, "password": "pw123456"}
        self.assertEqual(self.client.post("/auth/login", json=body).json()["purpose"], "login")
        with mock.patch.object(auth, "_DEV_MODE", True):
            self.assertIn("token", self.client.post("/auth/login", json=body).json())


class TemplateTests(unittest.TestCase):
    def test_templates_have_code_expiry_warning_and_escape_name(self):
        for purpose in ("verify", "login", "reset"):
            captured = {}
            with mock.patch.object(auth, "_send_email",
                                   side_effect=lambda to, subj, html, text: captured.update(subj=subj, html=html, text=text) or True):
                _REAL_SEND_CODE(EMAIL, "<Ana>", "123456", purpose)
            self.assertIn("123456", captured["html"])
            self.assertIn("123456", captured["text"])
            self.assertIn("5 minutes", captured["html"])
            self.assertIn("Never share this code", captured["html"])
            self.assertIn("&lt;Ana&gt;", captured["html"])
            self.assertIn("GENTEK", captured["subj"])


if __name__ == "__main__":
    unittest.main()
