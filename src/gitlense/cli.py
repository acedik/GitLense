"""Command-line interface and argument validation for GitLense.

Stage 1 scope: parse and validate a GitHub repository URL, and expose the
``gitlense`` console entry point. Repository analysis is wired up in later
stages (GitHub API client in Stage 2, metadata summaries in Stage 3).

Exit codes:
    0 - success
    1 - runtime failure (network, API, unexpected error)
    2 - invalid user input (malformed URL, bad arguments)
"""

from __future__ import annotations

import argparse
import re
import sys
from collections.abc import Sequence
from urllib.parse import urlparse

from gitlense import __version__
from gitlense.exceptions import GitLenseError, InvalidRepositoryURLError

#: Only github.com over HTTPS is accepted; this prevents credential leakage
#: (e.g. "https://github.com@evil.example/owner/repo") and lookalike hosts.
_ALLOWED_HOST = "github.com"
_ALLOWED_SCHEME = "https"

#: GitHub rules: owner names are alphanumeric or hyphen; repository names may
#: also contain dots and underscores. A superset pattern is enforced here and
#: the API performs the authoritative existence/access check.
_NAME_PATTERN = re.compile(r"[A-Za-z0-9_.-]+")


def parse_repository_url(url: str) -> tuple[str, str]:
    """Validate a GitHub repository URL and return ``(owner, repo)``.

    Accepted form: ``https://github.com/OWNER/REPO`` with an optional
    trailing slash and/or ``.git`` suffix.

    Args:
        url: The repository URL supplied by the user.

    Returns:
        A ``(owner, repo)`` tuple with any ``.git`` suffix removed.

    Raises:
        InvalidRepositoryURLError: If the URL is empty, not HTTPS, not on
            github.com, does not contain exactly ``owner/repo`` path
            segments, or contains invalid name characters.
    """
    if not url or not url.strip():
        raise InvalidRepositoryURLError(
            "Repository URL is empty. "
            "Use a URL like https://github.com/OWNER/REPOSITORY"
        )

    parsed = urlparse(url.strip())

    if parsed.scheme != _ALLOWED_SCHEME:
        raise InvalidRepositoryURLError(
            f"Unsupported URL scheme {parsed.scheme!r}. "
            "Use https://github.com/OWNER/REPOSITORY"
        )

    # urlparse treats "evil.example@github.com" as host=github.com with
    # userinfo=evil.example. Such URLs are deceptive-looking; reject them.
    # (No request is ever made to the supplied URL, so nothing leaks, but a
    # clean URL keeps reports and logs unambiguous.)
    if parsed.username is not None or parsed.password is not None:
        raise InvalidRepositoryURLError(
            "URL must not contain embedded credentials or userinfo. "
            "Use https://github.com/OWNER/REPOSITORY"
        )

    if parsed.hostname != _ALLOWED_HOST:
        raise InvalidRepositoryURLError(
            f"Unsupported host {parsed.hostname!r}. "
            "Only repositories on github.com are supported."
        )

    parts = parsed.path.strip("/").split("/")
    if len(parts) != 2 or not all(parts):
        raise InvalidRepositoryURLError(
            "URL path must identify exactly one repository: "
            "https://github.com/OWNER/REPOSITORY"
        )

    owner, repo = parts
    repo = re.sub(r"\.git$", "", repo)

    if not _NAME_PATTERN.fullmatch(owner):
        raise InvalidRepositoryURLError(
            f"Invalid repository owner {owner!r}. "
            "Owner names may contain letters, digits, and hyphens."
        )

    if not _NAME_PATTERN.fullmatch(repo):
        raise InvalidRepositoryURLError(
            f"Invalid repository name {repo!r}. "
            "Names may contain letters, digits, '.', '_', and '-'."
        )

    return owner, repo


def build_parser() -> argparse.ArgumentParser:
    """Build the GitLense argument parser.

    Returns:
        The configured :class:`argparse.ArgumentParser`.
    """
    parser = argparse.ArgumentParser(
        prog="gitlense",
        description=(
            "GitHub OSINT and authorized repository security analysis. "
            "Analyze public repositories, or private repositories you are "
            "authorized to access (set GITHUB_TOKEN)."
        ),
    )
    parser.add_argument(
        "url",
        help="GitHub repository URL, e.g. https://github.com/OWNER/REPOSITORY",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """GitLense console entry point.

    Args:
        argv: Optional argument list (defaults to ``sys.argv[1:]``).
            Injectable for testing.

    Returns:
        Process exit code (see module docstring).
    """
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        owner, repo = parse_repository_url(args.url)
    except InvalidRepositoryURLError as exc:
        print(f"Input error: {exc}", file=sys.stderr)
        return 2
    except GitLenseError as exc:  # pragma: no cover - defensive catch-all
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print("Repository URL validated successfully.")
    print(f"  Owner     : {owner}")
    print(f"  Repository: {repo}")
    print(
        "Analysis features (API client, metadata, branches, commits, "
        "contributors, scanning) are added in later development stages."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
