"""Unit tests for the GitHub API client."""

import json
from unittest.mock import Mock, patch

import pytest
import requests

from gitlense.exceptions import (
    AuthenticationError,
    GitHubAPIError,
    NetworkError,
    RateLimitExceededError,
    RepositoryNotFoundError,
    TimeoutError,
)
from gitlense.github_client import (
    GitHubClient,
    GitHubClientConfig,
    create_client,
)


class TestGitHubClientConfig:
    """Tests for GitHubClientConfig dataclass."""

    def test_defaults(self):
        config = GitHubClientConfig()
        assert config.timeout == 15.0
        assert config.per_page == 30
        assert config.user_agent == "GitLense/0.1.0"
        assert config.api_base == "https://api.github.com"

    def test_custom_values(self):
        config = GitHubClientConfig(
            timeout=30.0,
            per_page=50,
            user_agent="CustomAgent/1.0",
            api_base="https://api.githubenterprise.com",
        )
        assert config.timeout == 30.0
        assert config.per_page == 50
        assert config.user_agent == "CustomAgent/1.0"
        assert config.api_base == "https://api.githubenterprise.com"


class TestCreateClient:
    """Tests for the create_client factory function."""

    def test_creates_client_with_defaults(self):
        client = create_client()
        assert isinstance(client, GitHubClient)
        assert client._config.timeout == 15.0
        assert client._config.per_page == 30

    def test_creates_client_with_custom_values(self):
        client = create_client(timeout=10.0, per_page=100, user_agent="Test/1.0")
        assert client._config.timeout == 10.0
        assert client._config.per_page == 100
        assert client._config.user_agent == "Test/1.0"


class TestGitHubClientHeaders:
    """Tests for header building."""

    def test_headers_without_token(self):
        client = GitHubClient()
        with patch.dict("os.environ", {}, clear=True):
            headers = client._build_headers()
        assert headers["Accept"] == "application/vnd.github+json"
        assert headers["X-GitHub-Api-Version"] == "2022-11-28"
        assert headers["User-Agent"] == "GitLense/0.1.0"
        assert "Authorization" not in headers

    def test_headers_with_token(self):
        client = GitHubClient()
        with patch.dict("os.environ", {"GITHUB_TOKEN": "ghp_test123"}):
            headers = client._build_headers()
        assert headers["Authorization"] == "Bearer ghp_test123"

    def test_custom_user_agent_in_headers(self):
        config = GitHubClientConfig(user_agent="Custom/1.0")
        client = GitHubClient(config=config)
        headers = client._build_headers()
        assert headers["User-Agent"] == "Custom/1.0"


class TestGitHubClientRequestErrors:
    """Tests for network and timeout error handling."""

    def test_timeout_raises_timeout_error(self):
        client = GitHubClient()
        with patch.object(client._session, "request", side_effect=requests.Timeout("timeout")):
            with pytest.raises(TimeoutError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert "15.0 seconds" in str(exc_info.value)

    def test_custom_timeout_in_error_message(self):
        config = GitHubClientConfig(timeout=5.5)
        client = GitHubClient(config=config)
        with patch.object(client._session, "request", side_effect=requests.Timeout("timeout")):
            with pytest.raises(TimeoutError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert "5.5 seconds" in str(exc_info.value)

    def test_connection_error_raises_network_error(self):
        client = GitHubClient()
        with patch.object(
            client._session, "request", side_effect=requests.ConnectionError("DNS failed")
        ):
            with pytest.raises(NetworkError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert "DNS failed" in str(exc_info.value)

    def test_generic_request_exception_raises_network_error(self):
        client = GitHubClient()
        with patch.object(
            client._session, "request", side_effect=requests.RequestException("Generic error")
        ):
            with pytest.raises(NetworkError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert "Generic error" in str(exc_info.value)


class TestGitHubClientHTTPErrors:
    """Tests for HTTP error status code handling."""

    def test_401_raises_authentication_error(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.ok = False
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(AuthenticationError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert exc_info.value.status_code == 401

    def test_404_raises_repository_not_found_error(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.ok = False
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(RepositoryNotFoundError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert exc_info.value.status_code == 404

    def test_403_with_rate_limit_header_raises_rate_limit_exceeded(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.ok = False
        mock_response.headers = {"X-RateLimit-Reset": "1234567890"}
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(RateLimitExceededError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert exc_info.value.status_code == 403
        assert exc_info.value.reset_at == 1234567890

    def test_403_without_rate_limit_header_raises_github_api_error(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.ok = False
        mock_response.headers = {}
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(GitHubAPIError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert exc_info.value.status_code == 403

    def test_500_raises_github_api_error_with_message(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.ok = False
        mock_response.headers = {}
        mock_response.json.return_value = {"message": "Internal Server Error"}
        mock_response.reason = "Internal Server Error"
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(GitHubAPIError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert exc_info.value.status_code == 500
        assert "Internal Server Error" in str(exc_info.value)

    def test_400_with_json_error_message(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.ok = False
        mock_response.headers = {}
        mock_response.json.return_value = {"message": "Bad Request: invalid parameter"}
        mock_response.reason = "Bad Request"
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(GitHubAPIError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert "invalid parameter" in str(exc_info.value)

    def test_error_without_json_body_uses_reason(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 502
        mock_response.ok = False
        mock_response.headers = {}
        mock_response.json.side_effect = json.JSONDecodeError("no json", "", 0)
        mock_response.reason = "Bad Gateway"
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(GitHubAPIError) as exc_info:
                client._request("GET", "/repos/owner/repo")
        assert "Bad Gateway" in str(exc_info.value)


class TestGitHubClientSuccess:
    """Tests for successful requests."""

    def test_get_returns_parsed_json(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {"name": "test-repo", "private": False}
        with patch.object(client._session, "request", return_value=mock_response):
            result = client.get("/repos/owner/repo")
        assert result == {"name": "test-repo", "private": False}

    def test_get_passes_params(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = []
        with patch.object(client._session, "request", return_value=mock_response) as mock_request:
            client.get("/repos/owner/repo", params={"per_page": 50})
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        assert call_args.kwargs["params"] == {"per_page": 50}


class TestGitHubClientPagination:
    """Tests for paginate method."""

    def test_paginate_yields_items_from_multiple_pages(self):
        client = GitHubClient(config=GitHubClientConfig(per_page=2))
        page1 = [{"id": 1}, {"id": 2}]
        page2 = [{"id": 3}]
        page3 = []

        responses = [
            Mock(status_code=200, ok=True, json=Mock(return_value=page1)),
            Mock(status_code=200, ok=True, json=Mock(return_value=page2)),
            Mock(status_code=200, ok=True, json=Mock(return_value=page3)),
        ]

        with patch.object(client._session, "request", side_effect=responses):
            items = list(client.paginate("/repos/owner/repo/branches", max_pages=3))

        assert items == [{"id": 1}, {"id": 2}, {"id": 3}]

    def test_paginate_stops_at_max_pages(self):
        client = GitHubClient()
        page1 = [{"id": 1}]
        page2 = [{"id": 2}]

        responses = [
            Mock(status_code=200, ok=True, json=Mock(return_value=page1)),
            Mock(status_code=200, ok=True, json=Mock(return_value=page2)),
        ]

        with patch.object(client._session, "request", side_effect=responses):
            items = list(client.paginate("/repos/owner/repo/branches", max_pages=1))

        assert items == [{"id": 1}]

    def test_paginate_stops_when_page_has_fewer_items_than_per_page(self):
        client = GitHubClient()
        page1 = [{"id": i} for i in range(30)]  # full page (per_page=30)
        page2 = [{"id": 30}, {"id": 31}]  # partial page

        responses = [
            Mock(status_code=200, ok=True, json=Mock(return_value=page1)),
            Mock(status_code=200, ok=True, json=Mock(return_value=page2)),
        ]

        with patch.object(client._session, "request", side_effect=responses):
            items = list(client.paginate("/repos/owner/repo/branches"))

        assert len(items) == 32


class TestGitHubClientRepositoryEndpoints:
    """Tests for repository-specific endpoints."""

    def test_get_repository_success(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {
            "full_name": "psf/requests",
            "description": "HTTP library",
            "private": False,
        }
        with patch.object(client._session, "request", return_value=mock_response):
            result = client.get_repository("psf", "requests")
        assert result["full_name"] == "psf/requests"

    def test_get_repository_404_raises_with_owner_repo(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.ok = False
        mock_response.headers = {}
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(RepositoryNotFoundError) as exc_info:
                client.get_repository("psf", "requests")
        assert exc_info.value.status_code == 404


class TestGitHubClientFileContent:
    """Tests for file content retrieval."""

    def test_get_file_content_base64_decoded(self):
        client = GitHubClient()
        import base64
        content_b64 = base64.b64encode(b"print('hello')").decode()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {
            "encoding": "base64",
            "content": content_b64,
        }
        with patch.object(client._session, "request", return_value=mock_response):
            result = client.get_file_content("owner", "repo", "test.py")
        assert result == "print('hello')"

    def test_get_file_content_handles_utf8_errors(self):
        client = GitHubClient()
        import base64
        # Invalid UTF-8 sequence
        content_b64 = base64.b64encode(b"\xff\xfe").decode()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {
            "encoding": "base64",
            "content": content_b64,
        }
        with patch.object(client._session, "request", return_value=mock_response):
            result = client.get_file_content("owner", "repo", "binary.dat")
        # Should not raise, should use replacement chars
        assert "\ufffd" in result

    def test_get_file_content_via_download_url(self):
        client = GitHubClient()
        mock_content_response = Mock()
        mock_content_response.status_code = 200
        mock_content_response.ok = True
        mock_content_response.json.return_value = {
            "download_url": "https://raw.githubusercontent.com/owner/repo/main/large.py",
        }

        mock_download_response = Mock()
        mock_download_response.status_code = 200
        mock_download_response.ok = True
        mock_download_response.text = "large file content"

        responses = [mock_content_response, mock_download_response]
        with patch.object(client._session, "request", side_effect=responses):
            result = client.get_file_content("owner", "repo", "large.py")
        assert result == "large file content"

    def test_get_file_content_raises_for_directory(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = [{"name": "file1.py"}, {"name": "file2.py"}]
        with patch.object(client._session, "request", return_value=mock_response):
            with pytest.raises(GitHubAPIError) as exc_info:
                client.get_file_content("owner", "repo", "somedir")
        assert "is a directory" in str(exc_info.value)


class TestGitHubClientRateLimit:
    """Tests for rate limit endpoint."""

    def test_get_rate_limit(self):
        client = GitHubClient()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {
            "resources": {"core": {"limit": 5000, "remaining": 4999}}
        }
        with patch.object(client._session, "request", return_value=mock_response):
            result = client.get_rate_limit()
        assert result["resources"]["core"]["limit"] == 5000


class TestGitHubClientCustomSession:
    """Tests for custom session injection (useful for testing)."""

    def test_uses_injected_session(self):
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {"ok": True}
        mock_session.request.return_value = mock_response

        client = GitHubClient(session=mock_session)
        client.get("/test")

        mock_session.request.assert_called_once()

    def test_creates_own_session_if_none_provided(self):
        client = GitHubClient()
        assert client._session is not None
        assert isinstance(client._session, requests.Session)