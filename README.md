# GitLense

**GitLense** is a Python-based command-line tool for GitHub Open-Source Intelligence (OSINT) and authorized repository security analysis.

## Features

- Public GitHub repository metadata analysis
- Branch, commit, and contributor summaries
- Bounded repository file discovery
- Pattern-based detection of potential exposed secrets
- Redaction of sensitive values in scan results
- Clear terminal reports
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

## Usage

Display help:

```bash
python src/github_osint.py --help
```

Analyze a public repository:

```bash
python src/github_osint.py https://github.com/psf/requests
```

## Testing

Run the test suite:

```bash
pytest
```

## Security

- Analyze only repositories you own or are authorized to inspect.
- Store GitHub tokens securely; never commit them to the repository.
- Report potential secrets with their values redacted.
- Do not attempt to use or validate discovered credentials.

## Project Status

GitLense is in early development. Features will be documented as they are implemented and tested.

## Author

**Anshuman Tiwari**
<<<<<<< HEAD
# github-osint-cli
# github-osint-cli
# github-osint-cli
# github-osint-cli
# github-osint-cli
=======
# GitLense
h
>>>>>>> e1af03b446f8a272d065a6bbee7de49254d52076
