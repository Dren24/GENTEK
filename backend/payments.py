# ── Payments routes (PayPal) ─────────────────────────────────────────────────
# Card / PayPal payments for Premium. All routes are prefixed with /payments
# and included by main.py. Called from src/components/shared/PaymentModal.jsx.
#
# How one payment works:
#   1. Browser shows PayPal's own buttons ("PayPal" and "Debit or Credit Card").
#      Card numbers are typed into PayPal's form, never into GENTEK's — GENTEK
#      never sees or stores card details.
#   2. Button click → POST /payments/orders {plan}: this server creates the
#      PayPal order with the price from SERVER settings (the browser can't
#      choose the amount) and saves a Payment row (status CREATED).
#   3. Buyer pays in PayPal's window → browser calls
#      POST /payments/orders/{id}/capture: this server asks PayPal to take the
#      money, checks PayPal says COMPLETED with the exact amount and currency,
#      and only THEN turns Premium on (premium_until += 30 days).
#   So Premium can't be unlocked without a real, verified PayPal payment.
#
# Settings (backend/.env locally, Render → Environment in production):
#   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET  — from developer.paypal.com
#   PAYPAL_MODE            — "sandbox" (test money, default) or "live" (real money).
#                            Sandbox keys only work with sandbox, live with live.
#   PREMIUM_MONTHLY_PRICE  — optional, default 599   (e.g. 20 for a cheap live demo)

import os
import threading
import time
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from html import escape

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
from database import get_db
from models import User, Payment

router = APIRouter(prefix="/payments", tags=["payments"])

CURRENCY = "PHP"
PLAN_DAYS = {"monthly": 30}          # the only plan: ₱599 for 30 days
PLAN_LABELS = {"monthly": "Premium — 30 days"}
_DEFAULT_PRICES = {"monthly": "599"}
_PRICE_ENV = {"monthly": "PREMIUM_MONTHLY_PRICE"}


def _mode() -> str:
    return "live" if os.getenv("PAYPAL_MODE", "sandbox").strip().lower() == "live" else "sandbox"


def _api_base() -> str:
    return "https://api-m.paypal.com" if _mode() == "live" else "https://api-m.sandbox.paypal.com"


def _credentials() -> tuple:
    return os.getenv("PAYPAL_CLIENT_ID", "").strip(), os.getenv("PAYPAL_CLIENT_SECRET", "").strip()


def _configured() -> bool:
    cid, secret = _credentials()
    return bool(cid and secret)


def plan_price(plan: str) -> str:
    """Price for a plan as PayPal wants it: a string with 2 decimals ("599.00").
    Falls back to the default if the env value is missing or not a positive number."""
    raw = os.getenv(_PRICE_ENV[plan], "").strip() or _DEFAULT_PRICES[plan]
    try:
        value = Decimal(raw)
        if value <= 0:
            raise InvalidOperation
    except InvalidOperation:
        value = Decimal(_DEFAULT_PRICES[plan])
    return str(value.quantize(Decimal("0.01")))


# ── PayPal API access token — cached until shortly before it expires ─────────
_token_cache = {"token": None, "expires": 0.0, "key": None}
_token_lock = threading.Lock()


def _access_token() -> str:
    cid, secret = _credentials()
    key = (cid, _mode())
    with _token_lock:
        if _token_cache["token"] and _token_cache["key"] == key and time.time() < _token_cache["expires"]:
            return _token_cache["token"]
        try:
            res = requests.post(
                f"{_api_base()}/v1/oauth2/token",
                auth=(cid, secret), data={"grant_type": "client_credentials"}, timeout=20,
            )
        except requests.RequestException:
            raise HTTPException(status_code=502, detail="Couldn't reach PayPal. Please try again.")
        if res.status_code != 200:
            print(f"[payments] PayPal auth failed ({res.status_code}) — check PAYPAL_CLIENT_ID/SECRET and PAYPAL_MODE")
            raise HTTPException(status_code=503, detail="Payments are not available right now.")
        data = res.json()
        _token_cache.update(token=data["access_token"], key=key,
                            expires=time.time() + int(data.get("expires_in", 300)) - 60)
        return _token_cache["token"]


def _paypal(method: str, path: str, **kwargs) -> requests.Response:
    headers = {"Authorization": f"Bearer {_access_token()}", "Content-Type": "application/json"}
    headers.update(kwargs.pop("headers", {}))
    try:
        return requests.request(method, f"{_api_base()}{path}", headers=headers, timeout=30, **kwargs)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Couldn't reach PayPal. Please try again.")


def _require_configured():
    if not _configured():
        raise HTTPException(status_code=503, detail="Payments are not set up yet.")


# ── GET /payments/config — what the browser needs to show the PayPal buttons ─
# The client ID is public by design (it's in PayPal's script URL); the secret
# never leaves the server.
@router.get("/config")
def payment_config():
    cid, _ = _credentials()
    return {
        "enabled": _configured(),
        "mode": _mode(),
        "client_id": cid if _configured() else None,
        "currency": CURRENCY,
        "plans": {p: {"amount": plan_price(p), "days": PLAN_DAYS[p], "label": PLAN_LABELS[p]} for p in PLAN_DAYS},
    }


# ── GET /payments/status — current plan, so the browser can refresh it ───────
# (Premium can end on its own; the saved profile in the browser may be stale.)
@router.get("/status")
def payment_status(db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return auth.premium_fields(user)


def _paid_premium_user(current_user: dict, db: Session) -> User:
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not (user.premium_active and user.premium_until):
        raise HTTPException(status_code=400, detail="You don't have a paid Premium plan to change.")
    return user


# ── POST /payments/cancel — stop Premium at the end of the paid period ────────
# Nothing is ever charged automatically, so cancelling takes no money back and
# needs nothing from PayPal: Premium simply stays on until premium_until (it
# was paid for) and the account then returns to Free. Undo with /resume.
@router.post("/cancel")
def cancel_premium(db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    user = _paid_premium_user(current_user, db)
    user.premium_cancelled = 1
    db.commit()
    return auth.premium_fields(user)


# ── POST /payments/resume — undo a cancel before Premium ends ────────────────
@router.post("/resume")
def resume_premium(db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    user = _paid_premium_user(current_user, db)
    user.premium_cancelled = 0
    db.commit()
    return auth.premium_fields(user)


class OrderRequest(BaseModel):
    plan: str


# ── POST /payments/orders — create a PayPal order for the chosen plan ─────────
@router.post("/orders")
def create_order(req: OrderRequest, db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    _require_configured()
    if req.plan not in PLAN_DAYS:
        raise HTTPException(status_code=400, detail="Unknown plan.")
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    amount = plan_price(req.plan)
    res = _paypal("POST", "/v2/checkout/orders", json={
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": req.plan,
            "custom_id": f"gentek-user-{user.id}",
            "description": f"GENTEK {PLAN_LABELS[req.plan]}",
            "amount": {"currency_code": CURRENCY, "value": amount},
        }],
        "application_context": {
            "brand_name": "GENTEK",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
        },
    })
    if res.status_code not in (200, 201):
        print(f"[payments] create order failed ({res.status_code}): {res.text[:500]}")
        raise HTTPException(status_code=502, detail="PayPal couldn't start the payment. Please try again.")
    order_id = res.json()["id"]

    db.add(Payment(user_id=user.id, order_id=order_id, plan=req.plan, amount=amount,
                   currency=CURRENCY, mode=_mode(), status="CREATED"))
    db.commit()
    return {"id": order_id}


def _first_capture(order: dict) -> dict:
    try:
        return order["purchase_units"][0]["payments"]["captures"][0]
    except (KeyError, IndexError, TypeError):
        return {}


def _activate_premium(user: User, payment: Payment, capture: dict, db: Session):
    now = datetime.utcnow()
    # Paying again while Premium is still running adds time on top of it
    start = user.premium_until if (user.premium_active and user.premium_until and user.premium_until > now) else now
    user.is_premium = 1
    user.premium_until = start + timedelta(days=PLAN_DAYS[payment.plan])
    user.premium_cancelled = 0   # buying again undoes an earlier cancel
    payment.status = "COMPLETED"
    payment.capture_id = capture.get("id")
    payment.completed_at = now
    db.commit()
    db.refresh(user)


def _send_receipt(user: User, payment: Payment):
    """Best-effort receipt email (PayPal also emails its own receipt)."""
    until = user.premium_until.strftime("%B %d, %Y") if user.premium_until else ""
    test = " (TEST payment — no real money)" if payment.mode == "sandbox" else ""
    subject = f"Your GENTEK Premium receipt{test}"
    text = (f"Hi {user.name},\n\nThanks for upgrading! Payment received{test}.\n\n"
            f"Plan: {PLAN_LABELS[payment.plan]}\nAmount: ₱{payment.amount} {payment.currency}\n"
            f"PayPal transaction ID: {payment.capture_id}\nPremium active until: {until}\n\n"
            f"Premium does not renew automatically. — GENTEK")
    html = (f"<p>Hi {escape(user.name)},</p><p>Thanks for upgrading! Payment received{escape(test)}.</p>"
            f"<table cellpadding='4'><tr><td>Plan</td><td><b>{escape(PLAN_LABELS[payment.plan])}</b></td></tr>"
            f"<tr><td>Amount</td><td><b>₱{escape(payment.amount)} {escape(payment.currency)}</b></td></tr>"
            f"<tr><td>PayPal transaction ID</td><td>{escape(payment.capture_id or '')}</td></tr>"
            f"<tr><td>Premium active until</td><td><b>{escape(until)}</b></td></tr></table>"
            f"<p>Premium does not renew automatically.</p><p>— GENTEK</p>")
    email = user.email
    threading.Thread(target=auth._send_email, args=(email, subject, html, text), daemon=True).start()


# ── POST /payments/orders/{order_id}/capture — take the money, then Premium ───
@router.post("/orders/{order_id}/capture")
def capture_order(order_id: str, db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    _require_configured()
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment or payment.user_id != current_user["id"]:
        raise HTTPException(status_code=404, detail="Payment not found.")
    user = db.query(User).filter(User.id == payment.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payment.status == "COMPLETED":   # already done (e.g. double click / retry)
        return {"status": "COMPLETED", **auth.premium_fields(user)}

    if payment.status == "PENDING":
        # Captured earlier but PayPal was still reviewing it — just re-check it
        res = _paypal("GET", f"/v2/checkout/orders/{order_id}")
    else:
        # PayPal-Request-Id makes a retried capture safe: PayPal returns the first result
        res = _paypal("POST", f"/v2/checkout/orders/{order_id}/capture", headers={"PayPal-Request-Id": f"capture-{order_id}"})
    order = res.json() if res.content else {}
    if res.status_code == 422 and any(d.get("issue") == "ORDER_ALREADY_CAPTURED" for d in order.get("details", [])):
        res = _paypal("GET", f"/v2/checkout/orders/{order_id}")
        order = res.json() if res.content else {}
    if res.status_code == 422 and any(d.get("issue") == "INSTRUMENT_DECLINED" for d in order.get("details", [])):
        # The browser restarts PayPal's window so the buyer can pick another card
        raise HTTPException(status_code=402, detail="INSTRUMENT_DECLINED")
    if res.status_code not in (200, 201):
        print(f"[payments] capture failed ({res.status_code}): {res.text[:500]}")
        payment.status = "FAILED"
        db.commit()
        raise HTTPException(status_code=402, detail="The payment didn't go through. You were not charged — please try again.")

    capture = _first_capture(order)
    amount = capture.get("amount", {})
    if capture.get("status") == "PENDING":
        payment.status = "PENDING"
        db.commit()
        raise HTTPException(status_code=409, detail="PayPal is still reviewing this payment. Premium turns on once PayPal completes it — contact us if it takes more than a day.")
    if (capture.get("status") != "COMPLETED" or amount.get("currency_code") != payment.currency
            or Decimal(amount.get("value", "0")) != Decimal(payment.amount)):
        print(f"[payments] capture mismatch for {order_id}: {capture}")
        payment.status = "FAILED"
        db.commit()
        raise HTTPException(status_code=402, detail="The payment couldn't be confirmed. Please contact us.")

    _activate_premium(user, payment, capture, db)
    _send_receipt(user, payment)
    return {"status": "COMPLETED", **auth.premium_fields(user)}
