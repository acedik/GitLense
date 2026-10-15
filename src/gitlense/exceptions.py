"""Application-specific exceptions for GitLense.

Every error raised intentionally by GitLense derives from
:class:`GitLenseError`, so the CLI layer can present a clean message and a
documented exit code instead of an uncaught traceback.
"""


class GitLenseError(Exception):
    """Base class for all GitLense application errors."""


class InvalidRepositoryURLError(GitLenseError, ValueError):
    """Raised when a repository URL cannot be parsed as ``owner/repo``.

    Also subclasses :class:`ValueError` so legacy code written against the
    original prototype (which raised plain ``ValueError``) keeps working
    during the staged migration.
    """


class GitHubAPIError(GitLenseError):
    """Raised when the GitHub API returns an error response.

    Attributes:
        status_code: The HTTP status code from the response.
        message: Human-readable error message.
    """

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"GitHub API error {status_code}: {message}")


class RepositoryNotFoundError(GitHubAPIError):
    """Raised when the requested repository does not exist or is inaccessible."""

    def __init__(self, owner: str, repo: str):
        super().__init__(404, f"Repository '{owner}/{repo}' not found or access denied")


class RateLimitExceededError(GitHubAPIError):
    """Raised when the GitHub API rate limit is exceeded.

    Attributes:
        reset_at: Unix timestamp when the rate limit resets, if available.
    """

    def __init__(self, reset_at: int | None = None):
        msg = "GitHub API rate limit exceeded"
        if reset_at:
            msg += f" (resets at {reset_at})"
        super().__init__(403, msg)
        self.reset_at = reset_at


class AuthenticationError(GitHubAPIError):
    """Raised when authentication fails or credentials are invalid."""

    def __init__(self):
        super().__init__(
            401,
            "GitHub API authentication failed. Check GITHUB_TOKEN.",
        )


class NetworkError(GitLenseError):
    """Raised when a network-level failure occurs (timeout, DNS, connection)."""

    def __init__(self, message: str):
        super().__init__(f"Network error: {message}")


class TimeoutError(GitLenseError):
    """Raised when a request times out."""

    def __init__(self, timeout: float):
        super().__init__(f"Request timed out after {timeout} seconds")
