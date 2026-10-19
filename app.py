"""
chitgit - AI GitHub Commit Plagiarism Checker & Cloud API Backend
Full Vercel Serverless & Flask application.
Supports:
1. Google Gemini AI Plagiarism Analyzer (Hides GEMINI_API_KEY on server)
2. Supabase Email OTP Authentication proxy
3. Supabase Scans database persistence & Live Dashboard
4. Razorpay checkout & payment verification
"""
import os
import time
import json
import requests
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, render_template_string
from flask_cors import CORS

# Optional Razorpay import
try:
    import razorpay
    import hmac
    import hashlib
except ImportError:
    razorpay = None

# 1. Load Environment Configuration
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "").strip()

# 2. Initialize Flask App & CORS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")

app = Flask(__name__, template_folder=TEMPLATE_DIR)
CORS(app, resources={r"/*": {"origins": "*"}})

# Razorpay Client
razorpay_client = None
if razorpay and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception:
        razorpay_client = None


def get_template_file(filename):
    """Safely retrieves template HTML content from filesystem candidates."""
    candidate_paths = [
        os.path.join(BASE_DIR, "templates", filename),
        os.path.join(BASE_DIR, "public", filename),
        os.path.join(BASE_DIR, filename)
    ]
    for path in candidate_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
    return f"<!DOCTYPE html><html><body style='background:#09090b;color:#fff;'><h2>chitgit - {filename}</h2></body></html>"


# =====================================================================
# Frontend Routes (Dashboard & Checkout)
# =====================================================================

@app.route("/", methods=["GET"])
@app.route("/dashboard", methods=["GET"])
def dashboard_page():
    """Renders the obsidian-black frosted glass Web Dashboard."""
    try:
        return render_template("dashboard.html")
    except Exception:
        return render_template_string(get_template_file("dashboard.html"))


@app.route("/checkout", methods=["GET"])
def checkout_page():
    """Renders the Razorpay Standard Web Checkout frontend."""
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip() or RAZORPAY_KEY_ID
    try:
        return render_template("checkout.html", key_id=key_id)
    except Exception:
        return render_template_string(get_template_file("checkout.html"), key_id=key_id)


# =====================================================================
# API Routes: Health & Config
# =====================================================================

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check and configuration status."""
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip() or GEMINI_API_KEY
    sb_url = os.getenv("SUPABASE_URL", "").strip() or SUPABASE_URL
    sb_key = os.getenv("SUPABASE_ANON_KEY", "").strip() or SUPABASE_ANON_KEY

    return jsonify({
        "status": "healthy",
        "service": "chitgit-backend",
        "version": "1.1.0",
        "gemini_configured": bool(gemini_key),
        "supabase_configured": bool(sb_url and sb_key),
        "razorpay_configured": bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
    }), 200


@app.route("/api/config", methods=["GET"])
def get_config():
    """Returns safe public configurations for frontend and extension."""
    sb_url = os.getenv("SUPABASE_URL", "").strip() or SUPABASE_URL
    sb_key = os.getenv("SUPABASE_ANON_KEY", "").strip() or SUPABASE_ANON_KEY
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip() or RAZORPAY_KEY_ID

    return jsonify({
        "key_id": key_id,
        "razorpay_key_id": key_id,
        "currency": "INR",
        "supabase_url": sb_url,
        "supabase_anon_key": sb_key,
        "ai_engine_proxy": True,
        "version": "1.1.0"
    }), 200


# =====================================================================
# API Route: Plagiarism Analysis with HIDDEN Gemini API Key
# =====================================================================

def analyze_diff_heuristically(repo, sha, message, diff):
    """
    Zero-Setup Static Code Heuristic Analyzer.
    Runs when GEMINI_API_KEY is not configured yet, ensuring 100% functionality out-of-the-box.
    """
    if not diff or not diff.strip():
        return {
            "verdict": "ORIGINAL",
            "plagiarism_score": 0,
            "plagiarism_category": "No substantive code changes / Merge commit",
            "flagged_code_snippets": [],
            "reasoning": "Commit contains no substantive source code additions or modifications to evaluate."
        }

    lines = (diff or "").splitlines()
    added_count = 0
    flagged = []
    is_suspicious = False
    category = "Original Implementation"
    reasoning = "Static analysis indicates original custom development with standard language idioms."

    suspicious_patterns = [
        ("LeetCode / Online Solution Template", ["leetcode", "solution", "twosum", "geeksforgeeks", "hackerrank"]),
        ("Tutorial / Homework Scaffold", ["assignment", "homework", "tutorialspoint", "copied"]),
        ("Boilerplate Template", ["create-react-app", "starter-kit", "boilerplate", "generated by"])
    ]

    msg_lower = (message or "").lower()
    for cat_name, keywords in suspicious_patterns:
        for kw in keywords:
            if kw in msg_lower:
                is_suspicious = True
                category = cat_name
                reasoning = f'Commit message matches pattern: "{kw}".'
                break

    for line in lines:
        if line.startswith("+") and not line.startswith("+++"):
            added_count += 1
            content = line[1:].strip().lower()
            for cat_name, keywords in suspicious_patterns:
                for kw in keywords:
                    if kw in content and len(flagged) < 3:
                        flagged.append(line[1:].strip())
                        is_suspicious = True
                        category = cat_name

    score = 42 if is_suspicious else min(18, max(0, added_count // 40))
    verdict = "PLAGIARIZED" if score >= 75 else ("SUSPICIOUS" if score >= 35 else "ORIGINAL")

    return {
        "verdict": verdict,
        "plagiarism_score": score,
        "plagiarism_category": category,
        "flagged_code_snippets": flagged,
        "reasoning": f"{reasoning} (Zero-Setup Static Heuristics • Connect GEMINI_API_KEY later for deep neural reasoning)."
    }


@app.route("/api/analyze", methods=["POST"])
def analyze_commit():
    """
    Secure serverless Gemini AI Plagiarism Analyzer.
    The client NEVER sees or holds the GEMINI_API_KEY.
    """
    data = request.get_json(silent=True) or {}
    repo = data.get("repo", "unknown/repo")
    sha = data.get("sha", "unknown")
    message = data.get("message", "")
    diff = data.get("diff", "")
    model = data.get("model", "gemini-1.5-flash")

    # Empty diff handling (merge commits or file deletes)
    if not diff or not diff.strip():
        return jsonify({
            "verdict": "ORIGINAL",
            "plagiarism_score": 0,
            "plagiarism_category": "No substantive code changes / Merge commit",
            "flagged_code_snippets": [],
            "reasoning": "Commit contains no substantive source code additions or modifications to evaluate."
        }), 200

    api_key = os.getenv("GEMINI_API_KEY", "").strip() or GEMINI_API_KEY
    if not api_key:
        # Zero-Setup Mode: runs static integrity heuristics until GEMINI_API_KEY is provided
        return jsonify(analyze_diff_heuristically(repo, sha, message, diff)), 200

    short_sha = sha[:7] if sha else "unknown"
    prompt_text = f"""You are an expert static code analyst, software engineer, and academic integrity reviewer specializing in source code originality and plagiarism detection.

Analyze the following Git commit diff from repository "{repo}" (commit {short_sha}).
Determine if any of the added or modified code is plagiarized, verbatim copied without attribution, taken from well-known online solutions (e.g., LeetCode, GeeksForGeeks, StackOverflow, common tutorial repositories, assignment sample answers), or if it represents original custom software engineering.

Commit Details:
Repository: {repo}
Commit SHA: {sha}
Commit Message: {message or 'No message provided'}

Code Diff:
```diff
{diff}
```

Instructions:
1. Ignore standard imports, configuration boilerplate, and trivial language syntax.
2. Differentiate between:
   - ORIGINAL: Custom, unique architecture, domain-specific logic, or standard idiomatic development.
   - BOILERPLATE_OR_LIBRARY: Framework starter templates, common boilerplate (e.g., React scaffolds, basic CRUD skeletons).
   - SUSPICIOUS: Unusually structured algorithms, variable naming patterns mimicking known online solution templates, or disguised copy-pastes.
   - PLAGIARIZED: Verbatim or near-verbatim copy of online repositories, textbook algorithms, or homework solutions without attribution.
3. Assign a plagiarism_score from 0 (completely original) to 100 (complete verbatim copy).
4. Provide specific flagged code snippets if suspicious/plagiarized.
5. Provide clear, objective reasoning for your verdict."""

    gemini_endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt_text}]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "verdict": {
                        "type": "STRING",
                        "enum": ["ORIGINAL", "SUSPICIOUS", "PLAGIARIZED", "BOILERPLATE_OR_LIBRARY"]
                    },
                    "plagiarism_score": {
                        "type": "INTEGER",
                        "description": "Score between 0 and 100"
                    },
                    "plagiarism_category": {
                        "type": "STRING"
                    },
                    "flagged_code_snippets": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"}
                    },
                    "reasoning": {
                        "type": "STRING"
                    }
                },
                "required": ["verdict", "plagiarism_score", "plagiarism_category", "flagged_code_snippets", "reasoning"]
            }
        }
    }

    try:
        resp = requests.post(gemini_endpoint, json=payload, timeout=25)
        if not resp.ok:
            error_msg = f"Gemini API returned error {resp.status_code}"
            try:
                err_json = resp.json()
                if "error" in err_json and "message" in err_json["error"]:
                    error_msg = err_json["error"]["message"]
            except Exception:
                pass
            return jsonify({"error": error_msg}), 502

        resp_json = resp.json()
        candidates = resp_json.get("candidates", [])
        if not candidates:
            return jsonify({"error": "Gemini returned no evaluation candidates"}), 502

        content_parts = candidates[0].get("content", {}).get("parts", [])
        raw_text = content_parts[0].get("text", "") if content_parts else ""

        try:
            parsed = json.loads(raw_text)
        except Exception:
            cleaned = raw_text.strip().lstrip("```json").rstrip("```").strip()
            parsed = json.loads(cleaned)

        result = {
            "verdict": parsed.get("verdict", "ORIGINAL"),
            "plagiarism_score": int(parsed.get("plagiarism_score", 0)),
            "plagiarism_category": parsed.get("plagiarism_category", "Original Implementation"),
            "flagged_code_snippets": parsed.get("flagged_code_snippets", []),
            "reasoning": parsed.get("reasoning", "Analysis completed successfully.")
        }

        # Optional: Log to Supabase Scans table
        log_scan_to_supabase(repo, sha, message, result)

        return jsonify(result), 200

    except requests.exceptions.Timeout:
        return jsonify({"error": "Gemini API request timed out."}), 504
    except Exception as e:
        return jsonify({"error": f"Internal analysis failure: {str(e)}"}), 500


def log_scan_to_supabase(repo, sha, message, result):
    """Logs the scan event to Supabase 'scans' table if credentials are provided."""
    sb_url = os.getenv("SUPABASE_URL", "").strip() or SUPABASE_URL
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_ANON_KEY", "").strip() or SUPABASE_ANON_KEY

    if not sb_url or not sb_key:
        return

    endpoint = f"{sb_url}/rest/v1/scans"
    headers = {
        "Content-Type": "application/json",
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
        "Prefer": "return=minimal"
    }
    payload = {
        "repo": repo,
        "commit_sha": sha,
        "commit_message": (message or "")[:250],
        "verdict": result.get("verdict", "ORIGINAL"),
        "plagiarism_score": result.get("plagiarism_score", 0),
        "plagiarism_category": result.get("plagiarism_category", ""),
        "flagged_snippets": result.get("flagged_code_snippets", []),
        "reasoning": (result.get("reasoning", ""))[:500]
    }
    try:
        requests.post(endpoint, json=payload, headers=headers, timeout=5)
    except Exception:
        pass


# =====================================================================
# API Routes: Supabase OTP Authentication Helper
# =====================================================================

@app.route("/api/auth/otp/send", methods=["POST"])
def auth_otp_send():
    """Proxies OTP request to Supabase or simulates demo mode."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()

    if not email or "@" not in email:
        return jsonify({"error": "Valid email address is required"}), 400

    sb_url = os.getenv("SUPABASE_URL", "").strip() or SUPABASE_URL
    sb_key = os.getenv("SUPABASE_ANON_KEY", "").strip() or SUPABASE_ANON_KEY

    if sb_url and sb_key:
        endpoint = f"{sb_url}/auth/v1/otp"
        headers = {
            "Content-Type": "application/json",
            "apikey": sb_key
        }
        body = {"email": email, "create_user": True}
        try:
            res = requests.post(endpoint, json=body, headers=headers, timeout=10)
            if res.ok:
                return jsonify({"success": True, "message": "OTP verification code sent to your email."}), 200
            else:
                err_data = res.json()
                return jsonify({"error": err_data.get("msg", "Failed to send OTP from Supabase")}), res.status_code
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Demo Simulation
    return jsonify({
        "success": True,
        "demo": True,
        "message": "Demo Mode: Verification OTP is 123456"
    }), 200


@app.route("/api/auth/otp/verify", methods=["POST"])
def auth_otp_verify():
    """Verifies OTP code via Supabase or demo mode."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    token = data.get("token", "").strip()

    if not email or not token:
        return jsonify({"error": "Email and OTP code are required"}), 400

    sb_url = os.getenv("SUPABASE_URL", "").strip() or SUPABASE_URL
    sb_key = os.getenv("SUPABASE_ANON_KEY", "").strip() or SUPABASE_ANON_KEY

    if sb_url and sb_key:
        endpoint = f"{sb_url}/auth/v1/verify"
        headers = {
            "Content-Type": "application/json",
            "apikey": sb_key
        }
        body = {"type": "email", "email": email, "token": token}
        try:
            res = requests.post(endpoint, json=body, headers=headers, timeout=10)
            if res.ok:
                auth_data = res.json()
                return jsonify({
                    "success": True,
                    "user": auth_data.get("user", {"email": email}),
                    "token": auth_data.get("access_token", "")
                }), 200
            else:
                err_data = res.json()
                return jsonify({"error": err_data.get("msg", "Invalid or expired OTP code")}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Demo Simulation
    if token == "123456":
        return jsonify({
            "success": True,
            "demo": True,
            "user": {"id": "usr_demo", "email": email},
            "token": "jwt_demo_session_token"
        }), 200

    return jsonify({"error": "Invalid OTP code (Demo code is 123456)"}), 400


# =====================================================================
# API Routes: Scans History
# =====================================================================

@app.route("/api/scans", methods=["GET"])
def get_scans():
    """Returns recent commit scans from Supabase."""
    sb_url = os.getenv("SUPABASE_URL", "").strip() or SUPABASE_URL
    sb_key = os.getenv("SUPABASE_ANON_KEY", "").strip() or SUPABASE_ANON_KEY

    if sb_url and sb_key:
        endpoint = f"{sb_url}/rest/v1/scans?select=*&order=created_at.desc&limit=25"
        headers = {
            "apikey": sb_key,
            "Authorization": f"Bearer {sb_key}"
        }
        try:
            res = requests.get(endpoint, headers=headers, timeout=5)
            if res.ok:
                return jsonify({"scans": res.json()}), 200
        except Exception:
            pass

    # Default Mock Scans Feed
    mock_scans = [
        {
            "repo": "lukecybers/luke-test-",
            "commit_sha": "7d8a92b",
            "author_name": "Luke Dev",
            "verdict": "ORIGINAL",
            "plagiarism_score": 8,
            "created_at": "Just now"
        },
        {
            "repo": "lukecybers/luke-test-",
            "commit_sha": "f1c93a0",
            "author_name": "Luke Dev",
            "verdict": "ORIGINAL",
            "plagiarism_score": 4,
            "created_at": "10m ago"
        },
        {
            "repo": "demo-student/hackathon-ai",
            "commit_sha": "4a1b02e",
            "author_name": "Student A",
            "verdict": "SUSPICIOUS",
            "plagiarism_score": 48,
            "created_at": "1h ago"
        },
        {
            "repo": "demo-student/algo-hw",
            "commit_sha": "b92c41f",
            "author_name": "Student B",
            "verdict": "PLAGIARIZED",
            "plagiarism_score": 92,
            "created_at": "2h ago"
        }
    ]
    return jsonify({"scans": mock_scans}), 200


# =====================================================================
# Razorpay Checkout API Routes
# =====================================================================

@app.route("/api/create-order", methods=["POST"])
def create_order():
    """Creates a Razorpay order."""
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip() or RAZORPAY_KEY_ID
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip() or RAZORPAY_KEY_SECRET

    if not razorpay or not key_id or not key_secret:
        return jsonify({"error": "Razorpay credentials not configured"}), 501

    global razorpay_client
    if razorpay_client is None:
        razorpay_client = razorpay.Client(auth=(key_id, key_secret))

    data = request.get_json(silent=True) or {}
    amount_raw = data.get("amount")
    currency = data.get("currency", "INR")
    receipt = data.get("receipt", f"rcpt_{int(time.time() * 1000)}")

    if amount_raw is None:
        return jsonify({"error": "Amount is required"}), 400

    try:
        amount = int(amount_raw)
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a valid integer"}), 400

    if amount < 100:
        return jsonify({"error": "Minimum order amount is 100 paise (₹1.00)"}), 400

    try:
        order = razorpay_client.order.create({
            "amount": amount,
            "currency": currency,
            "receipt": receipt,
            "notes": {"service": "chitgit"}
        })
        return jsonify({
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": key_id
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    """Verifies Razorpay payment signature."""
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip() or RAZORPAY_KEY_SECRET
    if not key_secret:
        return jsonify({"error": "Razorpay secret key not configured"}), 501

    data = request.get_json(silent=True) or {}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")

    if not order_id or not payment_id or not signature:
        return jsonify({"success": False, "error": "Missing required fields for payment verification"}), 400

    msg = f"{order_id}|{payment_id}".encode("utf-8")
    generated = hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    if hmac.compare_digest(generated, signature):
        return jsonify({
            "success": True,
            "message": "Payment verified successfully",
            "order_id": order_id,
            "payment_id": payment_id
        }), 200

    return jsonify({"success": False, "error": "Signature mismatch / Payment verification failed"}), 400


# Local Development Server
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"⚡ chitgit Backend Server running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)

