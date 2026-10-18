"""
chitgit / GitLense - Razorpay Standard Web Checkout Server
Provides endpoints for creating orders, serving the frontend checkout page,
and cryptographically verifying payment signatures.
"""
import os
import time
import hmac
import hashlib
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import razorpay

# 1. Load Environment Configuration
load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
PORT = int(os.getenv("PORT", 5000))

# 2. Determine Base and Template Directories (works for local and Vercel serverless)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(BASE_DIR, "templates")):
    TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
elif os.path.exists(os.path.join(BASE_DIR, "api", "templates")):
    TEMPLATE_DIR = os.path.join(BASE_DIR, "api", "templates")
else:
    TEMPLATE_DIR = os.path.join(os.path.dirname(BASE_DIR), "templates")

STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 3. Initialize Razorpay Client
client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


@app.route("/", methods=["GET"])
@app.route("/checkout", methods=["GET"])
def checkout_page():
    """Renders the Razorpay Standard Web Checkout frontend."""
    return render_template("checkout.html", key_id=RAZORPAY_KEY_ID)


@app.route("/api/config", methods=["GET"])
def get_config():
    """Returns the public Razorpay Key ID (never exposes secret key)."""
    if not RAZORPAY_KEY_ID:
        return jsonify({"error": "RAZORPAY_KEY_ID not configured"}), 401
    return jsonify({
        "key_id": RAZORPAY_KEY_ID,
        "currency": "INR"
    }), 200


@app.route("/api/create-order", methods=["POST"])
def create_order():
    """
    Creates a Razorpay order.
    Request body: { amount (in paise), currency (optional, default 'INR'), receipt (optional) }
    Response: { order_id, amount, currency, key_id }
    """
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET or client is None:
        return jsonify({"error": "Razorpay authentication failed: Missing or invalid API credentials"}), 401

    data = request.get_json(silent=True) or {}
    amount_raw = data.get("amount")
    currency = data.get("currency", "INR")
    receipt = data.get("receipt", f"rcpt_{int(time.time() * 1000)}")

    # 1. Validate Amount Presence
    if amount_raw is None:
        return jsonify({"error": "Amount is required"}), 400

    # 2. Validate Amount Data Type & Minimum Value (>= 100 paise / ₹1)
    try:
        amount = int(amount_raw)
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a valid integer in paise"}), 400

    if amount < 100:
        return jsonify({"error": "Invalid amount: Minimum order amount is 100 paise (₹1)"}), 400

    # 3. Create Order via Razorpay SDK
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
            "key_id": RAZORPAY_KEY_ID
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
    if not RAZORPAY_KEY_SECRET:
        return jsonify({"error": "Server configuration error: Key Secret missing"}), 401

    data = request.get_json(silent=True) or {}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")

    # 1. Check Missing Fields
    if not order_id or not payment_id or not signature:
        return jsonify({
            "success": False,
            "error": "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature must all be provided"
        }), 400

    # 2. Compute Expected Signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    payload = f"{order_id}|{payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()

    # 3. Cryptographically Verify Signature Match
    if hmac.compare_digest(expected_signature, signature):
        return jsonify({
            "success": True,
            "message": "Payment verified successfully",
            "order_id": order_id,
            "payment_id": payment_id
        }), 200
    else:
        # Signature mismatch: return 400, do NOT mark as paid
        return jsonify({
            "success": False,
            "error": "Payment verification failed: Signature mismatch"
        }), 400


if __name__ == "__main__":
    print(f"🚀 chitgit Razorpay Checkout Server running at http://localhost:{PORT}")
    print(f"🔑 Using Razorpay Key ID: {RAZORPAY_KEY_ID}")
    app.run(host="0.0.0.0", port=PORT, debug=True)
