"""
chitgit / GitLense - Razorpay Standard Web Checkout Flask Application
Native Vercel Flask entry point & local development server.
"""
import os
import time
import hmac
import hashlib
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, render_template_string
from flask_cors import CORS
import razorpay

# 1. Load Environment Configuration
load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "").strip()

# 2. Initialize Flask App & CORS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")

app = Flask(__name__, template_folder=TEMPLATE_DIR)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 3. Initialize Razorpay Client
client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception:
        client = None


def get_checkout_html():
    """Safely retrieves the checkout page HTML."""
    candidate_paths = [
        os.path.join(BASE_DIR, "templates", "checkout.html"),
        os.path.join(BASE_DIR, "api", "templates", "checkout.html"),
        os.path.join(BASE_DIR, "api", "checkout.html")
    ]
    for path in candidate_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
    return "<!DOCTYPE html><html><body style='background:#09090b;color:#fff;text-align:center;'><h2>chitgit Checkout Active</h2></body></html>"


@app.route("/", methods=["GET"])
@app.route("/checkout", methods=["GET"])
def checkout_page():
    """Renders the Razorpay Standard Web Checkout frontend."""
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip() or RAZORPAY_KEY_ID
    try:
        return render_template("checkout.html", key_id=key_id)
    except Exception:
        return render_template_string(get_checkout_html(), key_id=key_id)


@app.route("/api/config", methods=["GET"])
def get_config():
    """Returns the public Razorpay Key ID (never exposes secret key)."""
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip() or RAZORPAY_KEY_ID
    if not key_id:
        return jsonify({"error": "RAZORPAY_KEY_ID not configured"}), 401
    return jsonify({
        "key_id": key_id,
        "currency": "INR"
    }), 200


@app.route("/api/create-order", methods=["POST"])
def create_order():
    """
    Creates a Razorpay order.
    Request body: { amount (in paise), currency (optional, default 'INR'), receipt (optional) }
    Response: { order_id, amount, currency, key_id }
    """
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip() or RAZORPAY_KEY_ID
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip() or RAZORPAY_KEY_SECRET

    if not key_id or not key_secret:
        return jsonify({"error": "Razorpay authentication failed: Missing API credentials"}), 401

    global client
    if client is None:
        client = razorpay.Client(auth=(key_id, key_secret))

    data = request.get_json(silent=True) or {}
    amount_raw = data.get("amount")
    currency = data.get("currency", "INR")
    receipt = data.get("receipt", f"rcpt_{int(time.time() * 1000)}")

    if amount_raw is None:
        return jsonify({"error": "Amount is required"}), 400

    try:
        amount = int(amount_raw)
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a valid integer in paise"}), 400

    if amount < 100:
        return jsonify({"error": "Invalid amount: Minimum order amount is 100 paise (₹1)"}), 400

    order_params = {
        "amount": amount,
        "currency": currency,
        "receipt": str(receipt),
        "payment_capture": 1
    }

    try:
        order = client.order.create(data=order_params)
        return jsonify({
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": key_id
        }), 200

    except razorpay.errors.BadRequestError as e:
        return jsonify({"error": f"Razorpay Bad Request: {str(e)}"}), 400
    except razorpay.errors.SignatureVerificationError as e:
        return jsonify({"error": f"Razorpay Verification Error: {str(e)}"}), 400
    except Exception as e:
        err_msg = str(e)
        if "401" in err_msg or "Authentication" in err_msg:
            return jsonify({"error": "Razorpay authentication failed"}), 401
        return jsonify({"error": f"Razorpay API Error: {err_msg}"}), 500


@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    """
    Verifies the Razorpay payment signature using HMAC-SHA256.
    Request body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    Response: { success: true/false, message: ... }
    """
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip() or RAZORPAY_KEY_SECRET

    if not key_secret:
        return jsonify({"error": "Server configuration error: Key Secret missing"}), 401

    data = request.get_json(silent=True) or {}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")

    if not order_id or not payment_id or not signature:
        return jsonify({
            "success": False,
            "error": "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature must all be provided"
        }), 400

    payload = f"{order_id}|{payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()

    if hmac.compare_digest(expected_signature, signature):
        return jsonify({
            "success": True,
            "message": "Payment verified successfully",
            "order_id": order_id,
            "payment_id": payment_id
        }), 200
    else:
        return jsonify({
            "success": False,
            "error": "Payment verification failed: Signature mismatch"
        }), 400


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 chitgit Razorpay Checkout Server running at http://localhost:{port}")
    print(f"🔑 Using Razorpay Key ID: {RAZORPAY_KEY_ID}")
    app.run(host="0.0.0.0", port=port, debug=True)
