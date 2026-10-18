"""
Vercel Serverless Function Entry Point for chitgit Razorpay Backend.
Exposes the Flask app instance for Vercel Python Runtime.
"""
import os
import sys

# Add root directory to Python path so server.py and modules can be imported
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(CURRENT_DIR)

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Import the configured Flask application
from server import app

# Vercel WSGI entry point
# Vercel looks for the variable named 'app'
