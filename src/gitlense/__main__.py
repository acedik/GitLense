"""Allow running GitLense with ``python -m gitlense``."""

from gitlense.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
