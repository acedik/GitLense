"""
Unit tests for Razorpay Standard Checkout endpoints.
Tests order creation, input validation, HMAC-SHA256 signature verification, and error handling.
"""
import hmac
import hashlib
import json
import pytest
from server import app, RAZORPAY_KEY_SECRET, RAZORPAY_KEY_ID


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_get_checkout_page(client):
    """Verifies that the checkout page renders with status 200 and includes Razorpay script."""
    response = client.get("/checkout")
    assert response.status_code == 200
    assert b"checkout.razorpay.com/v1/checkout.js" in response.data
    assert b"chitgit Pro" in response.data


def test_get_api_config(client):
    """Verifies that /api/config returns the public Key ID and currency."""
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.get_json()
    assert data["key_id"] == RAZORPAY_KEY_ID
    assert data["currency"] == "INR"
    # Ensure secret is never exposed
    assert "key_secret" not in data


def test_create_order_success(client):
    """Verifies successful order creation for valid amount >= 100 paise."""
    payload = {
        "amount": 29900,  # ₹299
        "currency": "INR",
        "receipt": "pytest_rcpt_1"
    }
    response = client.post("/api/create-order", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert "order_id" in data
    assert data["order_id"].startswith("order_")
    assert data["amount"] == 29900
    assert data["currency"] == "INR"


def test_create_order_minimum_amount_validation(client):
    """Verifies rejection when amount is less than 100 paise."""
    payload = {
        "amount": 50,  # 50 paise is below minimum (100 paise)
        "currency": "INR"
    }
    response = client.post("/api/create-order", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "Minimum order amount is 100 paise" in data["error"]


def test_create_order_missing_amount(client):
    """Verifies rejection when amount is missing from the payload."""
    payload = {
        "currency": "INR"
    }
    response = client.post("/api/create-order", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "Amount is required" in data["error"]


def test_create_order_invalid_amount_type(client):
    """Verifies rejection when amount is not an integer."""
    payload = {
        "amount": "not-a-number"
    }
    response = client.post("/api/create-order", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "Amount must be a valid integer" in data["error"]


def test_verify_payment_missing_fields(client):
    """Verifies that /api/verify-payment returns 400 if any required field is missing."""
    # Missing signature
    payload = {
        "razorpay_order_id": "order_test123",
        "razorpay_payment_id": "pay_test123"
    }
    response = client.post("/api/verify-payment", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "Missing required fields" in data["error"]


def test_verify_payment_valid_signature(client):
    """Verifies successful payment verification when HMAC-SHA256 signature matches."""
    order_id = "order_pytest_valid_123"
    payment_id = "pay_pytest_valid_456"

    # Compute valid signature using the key secret
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    valid_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        msg,
        hashlib.sha256
    ).hexdigest()

    payload = {
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_signature
    }
    response = client.post("/api/verify-payment", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["message"] == "Payment verified successfully"
    assert data["order_id"] == order_id
    assert data["payment_id"] == payment_id


def test_verify_payment_invalid_signature_tampered(client):
    """Verifies that tampered / invalid signatures return 400 and fail verification."""
    payload = {
        "razorpay_order_id": "order_pytest_123",
        "razorpay_payment_id": "pay_pytest_456",
        "razorpay_signature": "fraudulent_tampered_signature_123456"
    }
    response = client.post("/api/verify-payment", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "Signature mismatch" in data["error"]
