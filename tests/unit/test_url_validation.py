"""Unit tests for GitLense URL validation and the Stage 1 CLI entry point."""

import pytest

from gitlense.cli import main, parse_repository_url
from gitlense.exceptions import GitLenseError, InvalidRepositoryURLError


class TestParseRepositoryUrlValid:
    """URLs that must parse to a correct (owner, repo) tuple."""

    @pytest.mark.parametrize(
        ("url", "expected"),
        [
            ("https://github.com/psf/requests", ("psf", "requests")),
            ("https://github.com/psf/requests/", ("psf", "requests")),
            ("https://github.com/psf/requests.git", ("psf", "requests")),
            ("https://github.com/psf/requests.git/", ("psf", "requests")),
            ("  https://github.com/psf/requests  ", ("psf", "requests")),
            ("https://github.com/torvalds/linux", ("torvalds", "linux")),
            # Dots, underscores and hyphens are valid in repo names.
            ("https://github.com/a-b/c_d.e", ("a-b", "c_d.e")),
            # Hostname matching is case-insensitive.
            ("https://github.com/OWNER/Repo", ("OWNER", "Repo")),
        ],
    )
    def test_valid_urls(self, url, expected):
        assert parse_repository_url(url) == expected


class TestParseRepositoryUrlInvalid:
    """URLs that must be rejected with InvalidRepositoryURLError."""

    @pytest.mark.parametrize(
        "url",
        [
            "",  # empty
            "   ",  # whitespace only
            "not-a-url",
            "https://github.com",  # no path
            "https://github.com/onlyowner",  # missing repo
            "https://github.com/owner/repo/extra",  # too many segments
            "https://github.com//repo",  # empty owner segment
            "https://github.com/owner/",  # missing repo name
            "http://github.com/owner/repo",  # non-HTTPS scheme
            "git://github.com/owner/repo",  # git scheme not accepted
            "https://gitlab.com/owner/repo",  # wrong host
            "https://github.com.evil.example/owner/repo",  # lookalike host
            "https://evil.example@github.com/owner/repo",  # bogus userinfo host
            "https://github.com/ow ner/repo",  # space in owner
            "https://github.com/owner/re%20po",  # encoded space in repo
            "https://github.com/$owner/repo",  # invalid character
        ],
    )
    def test_invalid_urls_raise(self, url):
        with pytest.raises(InvalidRepositoryURLError):
            parse_repository_url(url)

    def test_error_is_also_value_error(self):
        """Backward compatibility with the prototype's ValueError contract."""
        with pytest.raises(ValueError):
            parse_repository_url("not-a-url")

    def test_error_is_gitlense_error(self):
        assert issubclass(InvalidRepositoryURLError, GitLenseError)

    def test_error_message_guides_user(self):
        with pytest.raises(InvalidRepositoryURLError, match="github.com"):
            parse_repository_url("ftp://example.com/a/b")


class TestMain:
    """Stage 1 CLI entry point behavior and exit codes."""

    def test_valid_url_returns_zero(self, capsys):
        assert main(["https://github.com/psf/requests"]) == 0
        out = capsys.readouterr().out
        assert "psf" in out
        assert "requests" in out

    def test_invalid_url_returns_two_and_writes_stderr(self, capsys):
        assert main(["http://github.com/psf/requests"]) == 2
        captured = capsys.readouterr()
        assert captured.out == ""
        assert "Input error" in captured.err

    @pytest.mark.parametrize("flag", ["-h", "--help"])
    def test_help_exits_zero(self, flag, capsys):
        with pytest.raises(SystemExit) as excinfo:
            main([flag])
        assert excinfo.value.code == 0
        assert "usage" in capsys.readouterr().out.lower()

    def test_version_exits_zero(self, capsys):
        with pytest.raises(SystemExit) as excinfo:
            main(["--version"])
        assert excinfo.value.code == 0
        assert "0.1.0" in capsys.readouterr().out

    def test_missing_url_argument_exits_two(self, capsys):
        with pytest.raises(SystemExit) as excinfo:
            main([])
        assert excinfo.value.code == 2
        assert "usage" in capsys.readouterr().err.lower()
