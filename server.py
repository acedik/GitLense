"""
chitgit / GitLense - Razorpay Standard Web Checkout Local Server
"""
import os
from app import app, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 chitgit Razorpay Checkout Server running at http://localhost:{port}")
    print(f"🔑 Using Razorpay Key ID: {RAZORPAY_KEY_ID}")
    app.run(host="0.0.0.0", port=port, debug=True)
