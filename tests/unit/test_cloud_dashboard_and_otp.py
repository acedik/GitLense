"""
Unit tests for chitgit Cloud Dashboard, Hidden API Key Analyzer, and OTP Auth.
"""
import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_dashboard_renders(client):
    """Test that the Web Dashboard loads successfully."""
    response = client.get("/")
    assert response.status_code == 200
    assert b"chitgit" in response.data
    assert b"Dashboard" in response.data


def test_health_check(client):
    """Test the health check endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert "gemini_configured" in data
    assert "supabase_configured" in data


def test_config_endpoint(client):
    """Test public config endpoint."""
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.get_json()
    assert data["ai_engine_proxy"] is True
    assert data["version"] == "1.1.0"


def test_analyze_empty_diff(client):
    """Test that empty diffs are immediately classified as original with zero score."""
    response = client.post("/api/analyze", json={
        "repo": "owner/repo",
        "sha": "1234567890abcdef",
        "message": "Merge pull request",
        "diff": ""
    })
    # If GEMINI_API_KEY is not configured in env, it returns 503; if configured, it returns 200 with ORIGINAL
    assert response.status_code in (200, 503)
    if response.status_code == 200:
        data = response.get_json()
        assert data["verdict"] == "ORIGINAL"
        assert data["plagiarism_score"] == 0


def test_otp_send_and_verify_demo(client):
    """Test OTP flow in demo fallback mode."""
    # Send OTP
    send_resp = client.post("/api/auth/otp/send", json={"email": "tester@example.com"})
    assert send_resp.status_code == 200
    send_data = send_resp.get_json()
    assert send_data["success"] is True

    # Verify invalid OTP
    bad_verify = client.post("/api/auth/otp/verify", json={"email": "tester@example.com", "token": "000000"})
    assert bad_verify.status_code == 400

    # Verify valid demo OTP
    good_verify = client.post("/api/auth/otp/verify", json={"email": "tester@example.com", "token": "123456"})
    assert good_verify.status_code == 200
    verify_data = good_verify.get_json()
    assert verify_data["success"] is True
    assert verify_data["user"]["email"] == "tester@example.com"
