# GitLense Architecture

## Overview

GitLense is a modular Python package under `src/gitlense/` built in tested
stages. Each module has a single responsibility, and all intentional errors
derive from `gitlense.exceptions.GitLenseError` so the CLI can present clean
messages and stable exit codes.

## Module Map

| Module | Responsibility | Status |
|---|---|---|
| `cli.py` | Command-line interface and argument validation | **Implemented (Stage 1)** |
| `exceptions.py` | Application-specific exception hierarchy | **Implemented (Stage 1–2)** |
| `github_client.py` | GitHub REST API client and error handling | **Implemented (Stage 2)** |
| `repository.py` | Repository metadata analysis | Planned (Stage 3) |
| `branches.py` | Branch summaries | Planned (Stage 3) |
| `commits.py` | Recent commit analysis | Planned (Stage 3) |
| `contributors.py` | Contributor summaries | Planned (Stage 3) |
| `file_scanner.py` | Bounded repository file discovery | Planned (Stage 4) |
| `secret_scanner.py` | Secret-pattern detection with value redaction | Planned (Stage 4) |
| `reporting.py` | Terminal reports and optional JSON output | Planned (Stage 5) |

`src/github_osint.py` is the preserved working prototype. Its logic is
migrated into the modules above across Stages 2–5.

## Entry Points

- `gitlense` console script (after `pip install -e .`) → `gitlense.cli:main`
- `python -m gitlense` → `gitlense/__main__.py`

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Runtime failure (network, API, unexpected error) |
| 2 | Invalid user input (malformed URL, bad arguments) |

## URL Validation Rules (Stage 1)

`gitlense.cli.parse_repository_url` accepts only
`https://github.com/OWNER/REPO`, with an optional trailing slash and/or
`.git` suffix. It rejects:

- Non-HTTPS schemes and non-github.com hosts (including lookalike hosts)
- URLs with embedded userinfo (e.g. `https://user@host/...`)
- Paths that do not contain exactly `owner/repo`
- Owner/repo names with characters outside `[A-Za-z0-9_.-]`

The URL is validated locally; no network request is made to it. The GitHub
API performs the authoritative existence and access check (Stage 2).

## GitHub API Client (Stage 2)

`gitlense.github_client.GitHubClient` provides a typed wrapper around the
GitHub REST API with:

- **Authentication**: Reads `GITHUB_TOKEN` from environment at request time
  (never cached at init). Supports explicit token injection for testing.
- **Error handling**: All failures raise typed exceptions from
  `gitlense.exceptions`:
  - `AuthenticationError` (401)
  - `RepositoryNotFoundError` (404)
  - `RateLimitExceededError` (403 with `X-RateLimit-Reset` header)
  - `GitHubAPIError` (other HTTP errors, with parsed message)
  - `NetworkError` (DNS, connection failures)
  - `TimeoutError` (request timeouts)
- **Configuration**: `GitHubClientConfig` dataclass for timeout, per-page
  limits, user-agent, and custom API base (GitHub Enterprise).
- **Pagination**: `paginate()` generator handles multi-page results with
  `max_pages` limit and automatic termination on partial pages.
- **Repository endpoints**: `get_repository`, `get_branches`, `get_commits`,
  `get_contributors`, `get_repository_contents`, `get_file_content`
  (handles base64 and download URLs), `get_rate_limit`.
- **Testability**: Accepts custom `requests.Session` for mocking; token
  injection via constructor.

## Testing

- `tests/unit/` — fast, offline unit tests (current: URL validation, CLI
  exit codes)
- `tests/integration/` — tests that may exercise the GitHub API, added in
  Stage 6
- pytest is configured in `pyproject.toml` (`pythonpath = ["src"]`,
  `testpaths = ["tests"]`)
