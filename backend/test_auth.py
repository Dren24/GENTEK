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

    def test_reset_signs_in_and_trusts_only_this_browser(self):
        old_device = self.verified_user()
        self.forgot()
        token = self.verify_reset(self.last_code("reset")).json()["reset_token"]
        r = self.reset(token).json()
        self.assertIn("token", r)
        self.assertIn("device_token", r)
        self.assertNotIn("password", r)
        # the reset browser logs in without a code; the old trusted one doesn't
        self.assertIn("token", self.login(password="newpass456", device_token=r["device_token"]).json())
        self.assertEqual(self.login(password="newpass456", device_token=old_device).json()["purpose"], "login")
        # the session token is a real login
        me = self.client.get(f"/auth/history/{r['id']}", headers={"Authorization": f"Bearer {r['token']}"})
        self.assertEqual(me.status_code, 200)

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


class GooglePasswordTests(OTPTestCase):
    """Google Sign-In accounts creating a GENTEK password. Google's token
    endpoints are simulated; everything else runs through the real API."""

    def setUp(self):
        super().setUp()
        mock.patch.object(auth, "GOOGLE_CLIENT_ID", "test-client").start()
        self.google_email = "gina@gmail.com"

        def fake_get(url, **kw):
            resp = mock.Mock(status_code=200)
            if url == auth.GOOGLE_TOKENINFO_URL:
                resp.json.return_value = {"aud": "test-client"}
            else:
                resp.json.return_value = {"sub": "g-123", "email": self.google_email,
                                          "email_verified": True, "name": "Gina"}
            return resp
        mock.patch.object(auth.requests, "get", side_effect=fake_get).start()

    def google_login(self):
        return self.client.post("/auth/google", json={"access_token": "x"}).json()

    def auth_headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def create_pw(self, token, pw="Strong123", code=None):
        return self.client.post("/auth/create-password", json={"new_password": pw, "code": code},
                                headers=self.auth_headers(token))

    def test_new_google_user_has_no_password(self):
        r = self.google_login()
        self.assertFalse(r["has_password"])
        # the random placeholder hash can't be used to log in
        self.assertEqual(self.login(email=self.google_email, password="anything1").status_code, 401)

    def test_create_password_right_after_google_sign_in_then_both_logins_work(self):
        r = self.google_login()
        self.assertEqual(self.create_pw(r["token"]).status_code, 200)
        # email + password now works for the SAME account (same id)
        pw_login = self.login(email=self.google_email, password="Strong123", device_token=r["device_token"]).json()
        self.assertEqual(pw_login["id"], r["id"])
        self.assertTrue(pw_login["has_password"])
        # Google still works, same account, no duplicate
        again = self.google_login()
        self.assertEqual(again["id"], r["id"])
        db = SessionLocal()
        self.assertEqual(db.query(User).filter_by(email=self.google_email).count(), 1)
        db.close()

    def test_cannot_create_twice_or_overwrite(self):
        r = self.google_login()
        self.create_pw(r["token"])
        second = self.create_pw(r["token"], pw="Hijack999")
        self.assertEqual(second.status_code, 409)
        self.assertEqual(self.login(email=self.google_email, password="Hijack999", device_token=r["device_token"]).status_code, 401)

    def test_existing_password_user_is_never_asked(self):
        device = self.verified_user()
        r = self.client.post("/auth/login", json={"email": EMAIL, "password": PW, "device_token": device}).json()
        self.assertTrue(r["has_password"])
        self.assertEqual(self.create_pw(r["token"]).status_code, 409)

    def test_weak_or_unauthenticated_requests_rejected(self):
        r = self.google_login()
        for weak in ("short1", "lettersonly", "12345678"):
            self.assertEqual(self.create_pw(r["token"], pw=weak).status_code, 400)
        self.assertEqual(self.client.post("/auth/create-password", json={"new_password": "Strong123"}).status_code, 403)

    def test_stale_session_needs_emailed_code(self):
        r = self.google_login()
        stale = auth.jwt.encode({"sub": str(r["id"]), "name": "Gina", "email": self.google_email,
                                 "iat": datetime.utcnow() - timedelta(minutes=auth.FRESH_SIGNIN_MINUTES + 1),
                                 "exp": datetime.utcnow() + timedelta(days=1)}, auth._JWT_SECRET, algorithm="HS256")
        self.assertEqual(self.create_pw(stale).status_code, 403)
        sent = self.client.post("/auth/create-password/send-code", headers=self.auth_headers(stale))
        self.assertEqual(sent.json()["purpose"], "setpw")
        self.assertEqual(self.sent[-1][0], self.google_email)       # code goes to the account's own address
        self.assertEqual(self.create_pw(stale, code=self.wrong(self.last_code("setpw"))).status_code, 400)
        self.assertEqual(self.create_pw(stale, code=self.last_code("setpw")).status_code, 200)

    def test_skip_keeps_google_login_working(self):
        r = self.google_login()   # user skips the prompt: nothing is called
        again = self.google_login()
        self.assertEqual(again["id"], r["id"])
        self.assertFalse(again["has_password"])

    def test_google_links_to_verified_password_account_and_keeps_password(self):
        self.google_email = EMAIL
        device = self.verified_user()
        r = self.google_login()
        self.assertTrue(r["has_password"])
        self.assertEqual(self.login(password=PW, device_token=r["device_token"]).json()["id"], r["id"])

    def test_google_link_wipes_password_of_unverified_signup(self):
        # Pre-hijack: someone registers the victim's address and never verifies.
        self.google_email = EMAIL
        self.signup(password="Attacker1")
        r = self.google_login()
        self.assertFalse(r["has_password"])
        self.assertEqual(self.login(password="Attacker1", device_token=r["device_token"]).status_code, 401)

    def test_change_password_points_google_user_to_create(self):
        r = self.google_login()
        res = self.client.put(f"/auth/change-password/{r['id']}", json={"current_password": "x", "new_password": "Strong123"},
                              headers=self.auth_headers(r["token"]))
        self.assertEqual(res.status_code, 400)
        self.assertIn("Create password", res.json()["detail"])

    def test_forgot_password_also_creates_a_password(self):
        r = self.google_login()
        self.forgot(email=self.google_email)
        token = self.verify_reset(self.last_code("reset"), email=self.google_email).json()["reset_token"]
        self.reset(token, "Strong123")
        self.assertTrue(self.google_login()["has_password"])

    def test_payload_never_contains_hash(self):
        r = self.google_login()
        self.assertNotIn("password", r)
        db = SessionLocal()
        stored = db.query(User).filter_by(email=self.google_email).one().password
        db.close()
        self.assertNotIn(stored, str(r))


class EmailTransportTests(unittest.TestCase):
    """Which transport _send_email uses; network calls are simulated."""

    def env(self, **values):
        return mock.patch.object(auth, "_env_value", side_effect=lambda name: values.get(name, ""))

    def test_brevo_used_when_key_set(self):
        resp = mock.Mock(status_code=201, text='{"messageId":"x"}')
        with self.env(BREVO_API_KEY="xkeysib-1", GMAIL_USER="gentekcaps@gmail.com", GMAIL_APP_PASSWORD="pw"), \
                mock.patch.object(auth.requests, "post", return_value=resp) as post, \
                mock.patch.object(auth.smtplib, "SMTP_SSL") as smtp:
            self.assertTrue(auth._send_email("ana@example.com", "Subj", "<b>hi</b>", "hi"))
        smtp.assert_not_called()
        self.assertEqual(post.call_args.args[0], auth.BREVO_URL)
        self.assertEqual(post.call_args.kwargs["headers"]["api-key"], "xkeysib-1")
        body = post.call_args.kwargs["json"]
        self.assertEqual(body["sender"], {"name": "GENTEK", "email": "gentekcaps@gmail.com"})
        self.assertEqual(body["to"], [{"email": "ana@example.com"}])
        self.assertEqual((body["subject"], body["htmlContent"], body["textContent"]), ("Subj", "<b>hi</b>", "hi"))

    def test_brevo_sender_override(self):
        resp = mock.Mock(status_code=201, text="{}")
        with self.env(BREVO_API_KEY="k", BREVO_SENDER_EMAIL="noreply@gentek.app", GMAIL_USER="g@gmail.com"), \
                mock.patch.object(auth.requests, "post", return_value=resp) as post:
            auth._send_email("ana@example.com", "S", "h")
        self.assertEqual(post.call_args.kwargs["json"]["sender"]["email"], "noreply@gentek.app")

    def test_brevo_error_raises_with_reason(self):
        resp = mock.Mock(status_code=400, text='{"message":"sender not valid"}')
        with self.env(BREVO_API_KEY="k", GMAIL_USER="g@gmail.com"), \
                mock.patch.object(auth.requests, "post", return_value=resp):
            with self.assertRaises(RuntimeError) as cm:
                auth._send_email("ana@example.com", "S", "h")
        self.assertIn("sender not valid", str(cm.exception))
        self.assertNotIn("k", str(cm.exception).split("Brevo HTTP")[0])

    def test_gmail_used_without_brevo(self):
        with self.env(GMAIL_USER="g@gmail.com", GMAIL_APP_PASSWORD="pw"), \
                mock.patch.object(auth.smtplib, "SMTP_SSL") as smtp, \
                mock.patch.object(auth.requests, "post") as post:
            self.assertTrue(auth._send_email("ana@example.com", "S", "h"))
        post.assert_not_called()
        smtp.return_value.__enter__.return_value.login.assert_called_once_with("g@gmail.com", "pw")

    def test_nothing_configured(self):
        with self.env():
            self.assertFalse(auth._send_email("ana@example.com", "S", "h"))
            self.assertFalse(auth._smtp_configured())
        with self.env(BREVO_API_KEY="k"):
            self.assertTrue(auth._smtp_configured())


class ContactFormTests(OTPTestCase):
    """Contact page form → GENTEK inbox. Delivery is captured, not sent."""

    def setUp(self):
        super().setUp()
        self.mail = []
        mock.patch.object(auth, "_send_email",
                          side_effect=lambda to, subj, html, text="", reply_to=None:
                          self.mail.append(dict(to=to, subj=subj, html=html, text=text, reply_to=reply_to)) or True).start()
        mock.patch.object(auth, "_smtp_configured", return_value=True).start()
        mock.patch.object(auth, "_env_value", side_effect=lambda n: {"GMAIL_USER": "gentekcaps@gmail.com"}.get(n, "")).start()

    def send(self, **over):
        body = {"name": "Juan dela Cruz", "email": "juan@example.com", "subject": "feedback",
                "message": "Great tool!\nThanks."}
        body.update(over)
        return self.client.post("/auth/contact", json=body)

    def test_message_goes_to_gentek_inbox_with_reply_to_sender(self):
        self.assertEqual(self.send().status_code, 200)
        m = self.mail[-1]
        self.assertEqual(m["to"], "gentekcaps@gmail.com")
        self.assertEqual(m["reply_to"], "juan@example.com")
        self.assertIn("Feedback / Suggestions", m["subj"])
        self.assertIn("Juan dela Cruz", m["subj"])
        self.assertIn("Great tool!", m["text"])

    def test_html_in_message_is_escaped(self):
        self.send(message="<script>alert(1)</script>", name="<b>Eve</b>")
        self.assertNotIn("<script>", self.mail[-1]["html"])
        self.assertIn("&lt;script&gt;", self.mail[-1]["html"])

    def test_line_breaks_in_name_cannot_inject_headers(self):
        self.send(name="Eve\r\nBcc: victim@example.com")
        self.assertNotIn("\n", self.mail[-1]["subj"])
        self.assertNotIn("\r", self.mail[-1]["subj"])

    def test_validation(self):
        for over in ({"name": ""}, {"email": "not-an-email"}, {"subject": "spam"}, {"message": "  "},
                     {"message": "x" * 5001}, {"email": "a@b.com\nBcc: x@y.com"}):
            self.assertEqual(self.send(**over).status_code, 400, over)
        self.assertEqual(self.mail, [])

    def test_rate_limited(self):
        for _ in range(3):
            self.assertEqual(self.send().status_code, 200)
        self.assertEqual(self.send().status_code, 429)

    def test_delivery_failure_reported(self):
        auth._send_email.side_effect = RuntimeError("Brevo HTTP 401")
        r = self.send()
        self.assertEqual(r.status_code, 503)
        self.assertNotIn("Brevo", r.json()["detail"])


class TemplateTests(unittest.TestCase):
    def test_templates_have_code_expiry_warning_and_escape_name(self):
        for purpose in ("verify", "login", "reset", "setpw"):
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
