# GitLense

**GitLense** is a Python-based command-line tool for GitHub Open-Source Intelligence (OSINT) and authorized repository security analysis.

## Features

- Validated GitHub repository URL handling via an installable CLI
- Public GitHub repository metadata analysis *(legacy prototype; staged migration in progress)*
- Branch, commit, and contributor summaries *(planned — Stage 3)*
- Bounded repository file discovery *(planned — Stage 4)*
- Pattern-based detection of potential exposed secrets with redaction *(planned — Stage 4)*
- Clear terminal reports and optional JSON output *(planned — Stage 5)*
- Automated tests and technical documentation

## Requirements

- Python 3.10 or later
- Git
- Internet connection
- GitHub account for authenticated API access when needed

## Installation

Clone the repository:

```bash
git clone git@github.com:acedik/GitLense.git
cd GitLense
```

Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Install the package in editable mode (provides the `gitlense` command):

```bash
pip install -e .
```

## Usage

Display help:

```bash
gitlense --help
```

Validate a repository URL (Stage 1 behavior):

```bash
gitlense https://github.com/psf/requests
```

Without installing, the same entry point is available as:

```bash
PYTHONPATH=src python -m gitlense https://github.com/psf/requests
```

### Legacy prototype

The original working prototype remains available and functional while its
logic is migrated into the `gitlense` package (Stages 2–5):

```bash
python src/github_osint.py https://github.com/psf/requests
```

## Project Structure

```
├── pyproject.toml          # Packaging, entry point, and pytest configuration
├── requirements.txt        # Pinned runtime/test dependencies
├── src/
│   ├── gitlense/           # Main package (modular architecture, staged build)
│   │   ├── __init__.py     # Package metadata
│   │   ├── __main__.py     # python -m gitlense support
│   │   ├── cli.py          # CLI entry point and URL validation
│   │   └── exceptions.py   # Application-specific exceptions
│   └── github_osint.py     # Legacy prototype (preserved, being migrated)
├── tests/
│   └── unit/               # Unit tests
└── docs/                   # Technical documentation
```

## Testing

Run the test suite:

```bash
pytest
```

Current coverage: repository URL validation and CLI exit-code behavior
(33 unit tests, all passing as of Stage 1).

## Security

- Analyze only repositories you own or are authorized to inspect. Private
  repositories are analyzed only when you are authorized to access them.
- Use the `GITHUB_TOKEN` environment variable for optional authenticated
  GitHub API access; never hardcode tokens, passwords, or private keys.
- Report potential secrets with their values redacted; never print, store,
  or commit detected secret values.
- Do not attempt to use or validate discovered credentials, and never
  bypass GitHub access controls.
- See [docs/security.md](docs/security.md) for the full security policy.

## Project Status

GitLense is in early development, built in tested stages:

- [x] **Stage 1** — Project structure, configuration, CLI entry point, URL validation
- [ ] **Stage 2** — GitHub API client with unit tests
- [ ] **Stage 3** — Repository metadata, branches, commits, contributors
- [ ] **Stage 4** — Bounded file discovery and secret-pattern scanning with redaction
- [ ] **Stage 5** — Terminal and JSON reporting
- [ ] **Stage 6** — Integration tests, error handling, docs, packaging, final verification

## Author

**KEVEN**
