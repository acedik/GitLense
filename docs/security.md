# GitLense Security Policy

GitLense is an OSINT and **authorized** security-analysis tool. These rules
are binding for all development stages.

## Authorization

- Analyze public repositories, and private repositories **only when the
  operator is authorized to access them**.
- Never attempt to bypass GitHub access controls.
- Access to a private repository must come solely from the operator's own
  `GITHUB_TOKEN` with its existing permissions.

## Credential Handling

- Authentication uses the `GITHUB_TOKEN` environment variable only — never
  hardcode tokens, passwords, or private keys in source, tests, or docs.
- Tokens are sent only to `api.github.com` over HTTPS.
- GitLense output must never include the token value.

## Secret Scanning (Stage 4+)

- Detected potential secrets are **always redacted** in all reports
  (terminal and JSON).
- Never print, store, or commit detected secret values.
- Never attempt to use or validate discovered credentials.

## Safe Failure

- Handle API rate limits, missing repositories, network errors, malformed
  URLs, and invalid responses with clear messages and documented exit codes
  (0 success, 1 runtime failure, 2 invalid input).
- Reasonable request timeouts and bounded scan limits are mandatory.
