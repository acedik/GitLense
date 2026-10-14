#!/usr/bin/env python3

import argparse
import os
import re
import sys
from urllib.parse import urlparse

import requests

API_BASE = "https://api.github.com"
TIMEOUT = 15


def parse_repository_url(url):
    """Validate a GitHub repository URL and return owner and repo."""
    parsed = urlparse(url.strip())

    if parsed.scheme != "https" or parsed.hostname != "github.com":
        raise ValueError(
            "Use a repository URL like "
            "https://github.com/OWNER/REPOSITORY"
        )

    parts = parsed.path.strip("/").split("/")

    if len(parts) != 2 or not all(parts):
        raise ValueError("URL must identify one repository.")

    owner, repo = parts
    repo = re.sub(r"\.git$", "", repo)

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner):
        raise ValueError("Invalid repository owner.")

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", repo):
        raise ValueError("Invalid repository name.")

    return owner, repo


def github_get(endpoint):
    """Request data from the GitHub API."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "GitHub-OSINT-CLI",
    }

    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = requests.get(
        f"{API_BASE}{endpoint}",
        headers=headers,
        timeout=TIMEOUT,
    )

    if response.status_code == 404:
        raise RuntimeError("Repository or API resource not found.")

    if response.status_code == 403:
        raise RuntimeError(
            "GitHub API access denied or rate limit reached. "
            "Try again later or configure GITHUB_TOKEN."
        )

    response.raise_for_status()
    return response.json()


def inspect_repository(owner, repo):
    """Retrieve basic public repository intelligence."""
    base = f"/repos/{owner}/{repo}"
    metadata = github_get(base)

    if metadata.get("private", True):
        raise RuntimeError("This initial version supports public repositories only.")

    print("\n=== GitHub OSINT Report ===")
    print(f"Repository : {metadata.get('full_name', 'N/A')}")
    print(f"Description: {metadata.get('description') or 'N/A'}")
    print(f"URL        : {metadata.get('html_url', 'N/A')}")
    print(f"Language   : {metadata.get('language') or 'N/A'}")
    print(f"Stars      : {metadata.get('stargazers_count', 0)}")
    print(f"Forks      : {metadata.get('forks_count', 0)}")
    print(f"Open issues: {metadata.get('open_issues_count', 0)}")
    print(f"Created    : {metadata.get('created_at', 'N/A')}")
    print(f"Updated    : {metadata.get('updated_at', 'N/A')}")
    print(f"Default branch: {metadata.get('default_branch', 'N/A')}")

    branches = github_get(base + "/branches?per_page=100")
    print(f"\nBranches ({len(branches)} returned):")
    for branch in branches:
        print(f"  - {branch.get('name', 'N/A')}")

    contributors = github_get(base + "/contributors?per_page=10")
    print("\nTop contributors (up to 10 returned):")
    for contributor in contributors:
        print(
            f"  - {contributor.get('login', 'N/A')}: "
            f"{contributor.get('contributions', 0)} contributions"
        )

    commits = github_get(base + "/commits?per_page=10")
    print("\nRecent commits (up to 10 returned):")
    for commit in commits:
        info = commit.get("commit", {})
        message = info.get("message", "").splitlines()[0]
        sha = commit.get("sha", "")[:7]
        author = info.get("author", {}).get("name", "Unknown")
        print(f"  - {sha} | {author} | {message[:120]}")


def main():
    parser = argparse.ArgumentParser(
        description="Collect basic OSINT from a public GitHub repository."
    )
    parser.add_argument(
        "url",
        help="Public GitHub repository URL",
    )
    args = parser.parse_args()

    try:
        owner, repo = parse_repository_url(args.url)
        inspect_repository(owner, repo)
    except ValueError as exc:
        print(f"Input error: {exc}", file=sys.stderr)
        return 2
    except requests.Timeout:
        print("Error: GitHub API request timed out.", file=sys.stderr)
        return 1
    except requests.RequestException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 403:
            print("Error: GitHub API rate limit or access restriction.", file=sys.stderr)
        else:
            print("Error: GitHub API request failed.", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
