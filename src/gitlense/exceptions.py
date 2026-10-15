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
