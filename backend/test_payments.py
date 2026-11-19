"""Tests for PayPal payments (backend/payments.py). PayPal itself is faked —
no network calls, no real or sandbox money.

Run: python3 -m unittest test_payments -v   (from backend/)
"""
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest import mock

_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"

from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
import main  # noqa: E402
import payments  # noqa: E402
from database import SessionLocal  # noqa: E402
from models import Payment, User  # noqa: E402


class FakeResponse:
    def __init__(self, status_code, data):
        self.status_code = status_code
        self._data = data
        self.content = b"x"
        self.text = str(data)

    def json(self):
        return self._data


def captured(order_id, value="599.00", currency="PHP", status="COMPLETED"):
    return {"id": order_id, "status": "COMPLETED", "purchase_units": [{"payments": {"captures": [
        {"id": "CAP-" + order_id, "status": status, "amount": {"currency_code": currency, "value": value}}]}}]}


class FakePayPal:
    """Stands in for payments._paypal. capture_result(order_id) decides what a capture returns."""
    def __init__(self):
        self.calls = []
        self.n = 0
        self.capture_result = lambda oid: FakeResponse(201, captured(oid))
        self.get_result = lambda oid: FakeResponse(200, captured(oid))

    def __call__(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        if method == "POST" and path == "/v2/checkout/orders":
            self.n += 1
            return FakeResponse(201, {"id": f"ORDER{self.n}", "status": "CREATED"})
        oid = path.split("/")[4]
        if path.endswith("/capture"):
            return self.capture_result(oid)
        return self.get_result(oid)


class PaymentTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.env = mock.patch.dict(os.environ, {"PAYPAL_CLIENT_ID": "cid", "PAYPAL_CLIENT_SECRET": "sec",
                                                "PAYPAL_MODE": "sandbox"})
        self.env.start()
        for k in ("PREMIUM_MONTHLY_PRICE", "PREMIUM_ANNUAL_PRICE"):
            os.environ.pop(k, None)
        self.paypal = FakePayPal()
        mock.patch.object(payments, "_paypal", self.paypal).start()
        self.emails = []
        mock.patch.object(auth, "_send_email", side_effect=lambda *a, **k: self.emails.append(a) or True).start()
        db = SessionLocal()
        db.query(Payment).delete()
        db.query(User).delete()
        self.ana = User(name="Ana", email="ana@example.com", password="x")
        self.ben = User(name="Ben", email="ben@example.com", password="x")
        db.add_all([self.ana, self.ben])
        db.commit()
        self.ana_id, self.ben_id = self.ana.id, self.ben.id
        db.close()

    def tearDown(self):
        mock.patch.stopall()
        self.env.stop()

    # ── helpers ────────────────────────────────────────────────────────────────
    def h(self, uid):
        return {"Authorization": f"Bearer {auth._create_token(uid, 'x', 'x@example.com')}"}

    def user(self, uid):
        db = SessionLocal()
        u = db.query(User).filter(User.id == uid).first()
        db.expunge(u)
        db.close()
        return u

    def order(self, plan="monthly", uid=None, **extra):
        return self.client.post("/payments/orders", json={"plan": plan, **extra}, headers=self.h(uid or self.ana_id))

    def capture(self, oid, uid=None):
        return self.client.post(f"/payments/orders/{oid}/capture", headers=self.h(uid or self.ana_id))

    # ── config ─────────────────────────────────────────────────────────────────
    def test_config_hides_secret_and_reports_prices(self):
        cfg = self.client.get("/payments/config").json()
        self.assertTrue(cfg["enabled"])
        self.assertEqual(cfg["client_id"], "cid")
        self.assertEqual(cfg["mode"], "sandbox")
        self.assertEqual(cfg["plans"]["monthly"]["amount"], "599.00")
        self.assertEqual(cfg["plans"]["annual"]["amount"], "5388.00")
        self.assertNotIn("sec", str(cfg))

    def test_disabled_without_keys(self):
        os.environ.pop("PAYPAL_CLIENT_SECRET")
        self.assertFalse(self.client.get("/payments/config").json()["enabled"])
        self.assertEqual(self.order().status_code, 503)

    def test_price_override_for_demo(self):
        os.environ["PREMIUM_MONTHLY_PRICE"] = "20"
        self.assertEqual(self.client.get("/payments/config").json()["plans"]["monthly"]["amount"], "20.00")
        os.environ["PREMIUM_MONTHLY_PRICE"] = "-5"   # nonsense falls back to the default
        self.assertEqual(payments.plan_price("monthly"), "599.00")

    # ── creating orders ────────────────────────────────────────────────────────
    def test_order_needs_login_and_valid_plan(self):
        self.assertIn(self.client.post("/payments/orders", json={"plan": "monthly"}).status_code, (401, 403))
        self.assertEqual(self.order("lifetime").status_code, 400)

    def test_browser_cannot_choose_the_amount(self):
        res = self.order("monthly", amount="1.00")
        self.assertEqual(res.status_code, 200)
        sent = self.paypal.calls[-1][2]["json"]["purchase_units"][0]["amount"]
        self.assertEqual(sent, {"currency_code": "PHP", "value": "599.00"})

    # ── capturing ──────────────────────────────────────────────────────────────
    def test_paid_order_turns_premium_on_for_30_days(self):
        self.assertFalse(self.user(self.ana_id).premium_active)
        oid = self.order().json()["id"]
        res = self.capture(oid)
        self.assertEqual(res.status_code, 200, res.text)
        self.assertTrue(res.json()["is_premium"])
        u = self.user(self.ana_id)
        self.assertTrue(u.premium_active)
        self.assertAlmostEqual((u.premium_until - datetime.utcnow()).days, 29, delta=1)
        self.assertEqual(len(self.emails), 1)   # receipt sent
        db = SessionLocal()
        p = db.query(Payment).filter(Payment.order_id == oid).first()
        self.assertEqual((p.status, p.capture_id), ("COMPLETED", "CAP-" + oid))
        db.close()

    def test_annual_plan_gives_a_year(self):
        self.paypal.capture_result = lambda oid: FakeResponse(201, captured(oid, "5388.00"))
        self.capture(self.order("annual").json()["id"])
        self.assertAlmostEqual((self.user(self.ana_id).premium_until - datetime.utcnow()).days, 364, delta=1)

    def test_capture_twice_counts_once(self):
        oid = self.order().json()["id"]
        self.capture(oid)
        first = self.user(self.ana_id).premium_until
        self.assertEqual(self.capture(oid).status_code, 200)
        self.assertEqual(self.user(self.ana_id).premium_until, first)

    def test_second_purchase_adds_time(self):
        self.capture(self.order().json()["id"])
        self.capture(self.order().json()["id"])
        self.assertAlmostEqual((self.user(self.ana_id).premium_until - datetime.utcnow()).days, 59, delta=1)

    def test_cannot_capture_someone_elses_order(self):
        oid = self.order(uid=self.ana_id).json()["id"]
        self.assertEqual(self.capture(oid, uid=self.ben_id).status_code, 404)
        self.assertFalse(self.user(self.ben_id).premium_active)
        self.assertEqual(self.capture("UNKNOWN").status_code, 404)

    def test_wrong_amount_or_currency_does_not_unlock(self):
        for value, cur in (("1.00", "PHP"), ("599.00", "USD")):
            self.paypal.capture_result = lambda oid, v=value, c=cur: FakeResponse(201, captured(oid, v, c))
            res = self.capture(self.order().json()["id"])
            self.assertEqual(res.status_code, 402)
        self.assertFalse(self.user(self.ana_id).premium_active)

    def test_declined_card(self):
        self.paypal.capture_result = lambda oid: FakeResponse(422, {"details": [{"issue": "INSTRUMENT_DECLINED"}]})
        res = self.capture(self.order().json()["id"])
        self.assertEqual((res.status_code, res.json()["detail"]), (402, "INSTRUMENT_DECLINED"))
        self.assertFalse(self.user(self.ana_id).premium_active)

    def test_pending_then_completed(self):
        self.paypal.capture_result = lambda oid: FakeResponse(201, captured(oid, status="PENDING"))
        oid = self.order().json()["id"]
        self.assertEqual(self.capture(oid).status_code, 409)
        self.assertFalse(self.user(self.ana_id).premium_active)
        self.assertEqual(self.capture(oid).status_code, 200)   # re-checked via GET, now COMPLETED
        self.assertTrue(self.user(self.ana_id).premium_active)
        self.assertEqual(self.paypal.calls[-1][0], "GET")

    def test_already_captured_is_recovered(self):
        self.paypal.capture_result = lambda oid: FakeResponse(422, {"details": [{"issue": "ORDER_ALREADY_CAPTURED"}]})
        self.assertEqual(self.capture(self.order().json()["id"]).status_code, 200)
        self.assertTrue(self.user(self.ana_id).premium_active)

    # ── expiry and the old free upgrade route ──────────────────────────────────
    def test_premium_ends_when_time_runs_out(self):
        db = SessionLocal()
        db.query(User).filter(User.id == self.ana_id).update(
            {User.is_premium: 1, User.premium_until: datetime.utcnow() - timedelta(minutes=1)})
        db.commit()
        db.close()
        status = self.client.get("/payments/status", headers=self.h(self.ana_id)).json()
        self.assertEqual(status, {"is_premium": False, "premium_until": None})
        self.assertFalse(self.user(self.ana_id).premium_active)   # what /analyze's word cap reads

    def test_free_upgrade_route_is_gone(self):
        res = self.client.put(f"/auth/upgrade/{self.ana_id}", headers=self.h(self.ana_id))
        self.assertIn(res.status_code, (404, 405))
        self.assertFalse(self.user(self.ana_id).premium_active)

    def test_deleting_account_removes_payments(self):
        self.capture(self.order().json()["id"])
        res = self.client.delete(f"/auth/delete/{self.ana_id}", headers=self.h(self.ana_id))
        self.assertEqual(res.status_code, 200)
        db = SessionLocal()
        self.assertEqual(db.query(Payment).filter(Payment.user_id == self.ana_id).count(), 0)
        db.close()


if __name__ == "__main__":
    unittest.main()
