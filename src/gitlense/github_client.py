"""GitHub REST API client for GitLense.

Provides a thin, typed wrapper around the GitHub REST API with:
- Optional authentication via GITHUB_TOKEN environment variable
- Consistent error handling with application-specific exceptions
- Configurable timeouts and pagination limits
- No credential logging or leakage
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import requests

from gitlense.exceptions import (
    AuthenticationError,
    GitHubAPIError,
    NetworkError,
    RateLimitExceededError,
    RepositoryNotFoundError,
    TimeoutError,
)

#: Default request timeout in seconds
DEFAULT_TIMEOUT = 15.0

#: GitHub API base URL
API_BASE = "https://api.github.com"

#: Default per-page limit for paginated endpoints
DEFAULT_PER_PAGE = 30

#: Maximum per-page limit allowed by GitHub
MAX_PER_PAGE = 100

#: Required Accept header for GitHub API v3
ACCEPT_HEADER = "application/vnd.github+json"

#: GitHub API version header
API_VERSION_HEADER = "2022-11-28"

#: Default User-Agent for requests
DEFAULT_USER_AGENT = "GitLense/0.1.0"


@dataclass(frozen=True, slots=True)
class GitHubClientConfig:
    """Configuration for the GitHub API client.

    Attributes:
        timeout: Request timeout in seconds.
        per_page: Default number of items per page for paginated endpoints.
        user_agent: User-Agent header value.
        api_base: Base URL for the GitHub API (for testing or GitHub Enterprise).
    """

    timeout: float = DEFAULT_TIMEOUT
    per_page: int = DEFAULT_PER_PAGE
    user_agent: str = DEFAULT_USER_AGENT
    api_base: str = API_BASE


class GitHubClient:
    """Client for interacting with the GitHub REST API.

    All methods raise application-specific exceptions from
    :mod:`gitlense.exceptions` on failure, never raw ``requests`` exceptions.

    Example:
        >>> client = GitHubClient()
        >>> repo = client.get_repository("psf", "requests")
        >>> print(repo["full_name"])
        psf/requests
    """

    def __init__(
        self,
        config: GitHubClientConfig | None = None,
        session: requests.Session | None = None,
        token: str | None = None,
    ) -> None:
        """Initialize the GitHub client.

        Args:
            config: Optional configuration object. Uses defaults if omitted.
            session: Optional ``requests.Session`` for connection pooling and
                testing. A new session is created if omitted.
            token: Optional GitHub token. If not provided, reads from
                ``GITHUB_TOKEN`` environment variable at request time.
        """
        self._config = config or GitHubClientConfig()
        self._session = session or requests.Session()
        self._token = token

    def _get_token(self) -> str | None:
        """Get the GitHub token, preferring instance token over environment."""
        if self._token is not None:
            return self._token
        return os.getenv("GITHUB_TOKEN")

    def _build_headers(self) -> dict[str, str]:
        """Build request headers including optional authentication."""
        headers = {
            "Accept": ACCEPT_HEADER,
            "X-GitHub-Api-Version": API_VERSION_HEADER,
            "User-Agent": self._config.user_agent,
        }
        token = self._get_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
    ) -> requests.Response:
        """Execute an HTTP request with error handling.

        Args:
            method: HTTP method (GET, POST, etc.).
            endpoint: API endpoint path (e.g., "/repos/owner/repo").
            params: Optional query parameters.

        Returns:
            The successful ``requests.Response`` object.

        Raises:
            TimeoutError: If the request times out.
            NetworkError: If a network-level failure occurs.
            AuthenticationError: If authentication fails (401).
            RepositoryNotFoundError: If resource not found (404).
            RateLimitExceededError: If rate limit exceeded (403 with rate limit headers).
            GitHubAPIError: For other API error responses.
        """
        url = f"{self._config.api_base}{endpoint}"
        headers = self._build_headers()

        try:
            response = self._session.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                timeout=self._config.timeout,
            )
        except requests.Timeout as exc:
            raise TimeoutError(self._config.timeout) from exc
        except requests.RequestException as exc:
            raise NetworkError(str(exc)) from exc

        # Handle non-success status codes
        if response.status_code == 401:
            raise AuthenticationError()

        if response.status_code == 403:
            # Check for rate limit headers
            reset_at = response.headers.get("X-RateLimit-Reset")
            if reset_at and reset_at.isdigit():
                raise RateLimitExceededError(reset_at=int(reset_at))
            # Could also be access forbidden
            raise GitHubAPIError(403, "Access forbidden or rate limit exceeded")

        if response.status_code == 404:
            raise RepositoryNotFoundError("unknown", "unknown")

        if not response.ok:
            # Try to extract error message from response
            try:
                error_data = response.json()
                message = error_data.get("message", response.reason)
            except Exception:
                message = response.reason or "Unknown error"
            raise GitHubAPIError(response.status_code, message)

        return response

    def get(self, endpoint: str, params: dict[str, Any] | None = None) -> Any:
        """Execute a GET request and return parsed JSON.

        Args:
            endpoint: API endpoint path.
            params: Optional query parameters.

        Returns:
            Parsed JSON response (dict or list).
        """
        response = self._request("GET", endpoint, params)
        return response.json()

    def paginate(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
        max_pages: int | None = None,
    ) -> Iterator[Any]:
        """Iterate over paginated API results.

        Args:
            endpoint: API endpoint path.
            params: Optional query parameters (per_page is added automatically).
            max_pages: Maximum number of pages to fetch (None for unlimited).

        Yields:
            Individual items from each page.
        """
        page = 1
        per_page = min(self._config.per_page, MAX_PER_PAGE)
        request_params = {**params, "per_page": per_page} if params else {"per_page": per_page}

        while True:
            request_params["page"] = page
            data = self.get(endpoint, request_params)

            if not data:
                break

            for item in data:
                yield item

            # Check if there's a next page via Link header
            # For simplicity, we stop when a page returns fewer items than per_page
            if len(data) < per_page:
                break

            page += 1
            if max_pages and page > max_pages:
                break

    # --- Repository endpoints ---

    def get_repository(self, owner: str, repo: str) -> dict[str, Any]:
        """Get repository metadata.

        Args:
            owner: Repository owner (user or organization).
            repo: Repository name.

        Returns:
            Repository metadata as a dictionary.

        Raises:
            RepositoryNotFoundError: If the repository doesn't exist or is inaccessible.
            AuthenticationError: If credentials are invalid.
            RateLimitExceededError: If rate limit is exceeded.
            NetworkError: On network failures.
            TimeoutError: If the request times out.
        """
        try:
            return self.get(f"/repos/{owner}/{repo}")
        except RepositoryNotFoundError:
            # Re-raise with correct owner/repo
            raise RepositoryNotFoundError(owner, repo)

    def get_branches(
        self, owner: str, repo: str, max_pages: int | None = None
    ) -> list[dict[str, Any]]:
        """List repository branches.

        Args:
            owner: Repository owner.
            repo: Repository name.
            max_pages: Maximum pages to fetch (None for all).

        Returns:
            List of branch objects.
        """
        return list(self.paginate(f"/repos/{owner}/{repo}/branches", max_pages=max_pages))

    def get_commits(
        self,
        owner: str,
        repo: str,
        sha: str | None = None,
        max_pages: int | None = None,
    ) -> list[dict[str, Any]]:
        """List repository commits.

        Args:
            owner: Repository owner.
            repo: Repository name.
            sha: Optional branch or commit SHA to start from.
            max_pages: Maximum pages to fetch (None for all).

        Returns:
            List of commit objects.
        """
        params = {"sha": sha} if sha else None
        return list(self.paginate(f"/repos/{owner}/{repo}/commits", params=params, max_pages=max_pages))

    def get_contributors(
        self,
        owner: str,
        repo: str,
        max_pages: int | None = None,
    ) -> list[dict[str, Any]]:
        """List repository contributors.

        Args:
            owner: Repository owner.
            repo: Repository name.
            max_pages: Maximum pages to fetch (None for all).

        Returns:
            List of contributor objects.
        """
        # Use anon=1 to include anonymous contributors if authenticated
        params = {"anon": "1"} if self._token else None
        return list(self.paginate(f"/repos/{owner}/{repo}/contributors", params=params, max_pages=max_pages))

    def get_repository_contents(
        self,
        owner: str,
        repo: str,
        path: str = "",
        ref: str | None = None,
    ) -> list[dict[str, Any]] | dict[str, Any]:
        """Get repository contents (files and directories).

        Args:
            owner: Repository owner.
            repo: Repository name.
            path: Path within the repository (empty for root).
            ref: Optional branch, tag, or commit SHA.

        Returns:
            List of content objects (for directories) or single content object (for files).
        """
        params = {"ref": ref} if ref else None
        endpoint = f"/repos/{owner}/{repo}/contents/{path}"
        return self.get(endpoint, params)

    def get_file_content(
        self,
        owner: str,
        repo: str,
        path: str,
        ref: str | None = None,
    ) -> str:
        """Get the decoded content of a file.

        Args:
            owner: Repository owner.
            repo: Repository name.
            path: Path to the file.
            ref: Optional branch, tag, or commit SHA.

        Returns:
            Decoded file content as string.

        Raises:
            GitHubAPIError: If the path is not a file or content is too large.
        """
        import base64

        content = self.get_repository_contents(owner, repo, path, ref)
        if isinstance(content, list):
            raise GitHubAPIError(400, f"Path '{path}' is a directory, not a file")

        if content.get("encoding") == "base64" and content.get("content"):
            return base64.b64decode(content["content"]).decode("utf-8", errors="replace")

        # For large files, GitHub returns a download URL
        if content.get("download_url"):
            response = self._request("GET", content["download_url"])
            return response.text

        raise GitHubAPIError(400, f"Unable to retrieve content for '{path}'")

    # --- Rate limit info ---

    def get_rate_limit(self) -> dict[str, Any]:
        """Get current rate limit status.

        Returns:
            Rate limit information from the API.
        """
        return self.get("/rate_limit")


def create_client(
    timeout: float = DEFAULT_TIMEOUT,
    per_page: int = DEFAULT_PER_PAGE,
    user_agent: str = DEFAULT_USER_AGENT,
) -> GitHubClient:
    """Factory function to create a GitHubClient with custom settings.

    Args:
        timeout: Request timeout in seconds.
        per_page: Items per page for paginated endpoints.
        user_agent: User-Agent header value.

    Returns:
        Configured ``GitHubClient`` instance.
    """
    config = GitHubClientConfig(
        timeout=timeout,
        per_page=per_page,
        user_agent=user_agent,
    )
    return GitHubClient(config)