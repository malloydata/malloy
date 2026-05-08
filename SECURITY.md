# Security Policy

## Supported Versions

Security fixes are applied to the latest published release only. We do not backport to older versions.

## Reporting a Vulnerability

**Do not report security vulnerabilities via public GitHub issues.**

Use [GitHub private vulnerability reporting](https://github.com/malloydata/malloy/security/advisories/new) to file a report confidentially. This is the preferred channel.

If private vulnerability reporting is unavailable, email `malloydata@google.com` with the subject line `Malloy security report`. Do not include exploit details in a public issue, discussion, or pull request.

### What to include

- A description of the vulnerability and its potential impact
- Steps to reproduce, including any Malloy source code or query required
- The version of `@malloydata/malloy` (or other affected package) you are using
- Any suggested remediation

### Response timeline

We aim to acknowledge reports within **3 business days** and provide a resolution or mitigation plan within **30 days** for valid vulnerabilities. We will credit reporters in the published security advisory unless you prefer to remain anonymous.

## Scope

**In scope:**
- SQL injection or unintended query expansion via crafted Malloy source
- Arbitrary file read/write via the DuckDB connector or other local connectors
- Credential leakage through connector error messages or logs
- Denial-of-service via maliciously crafted Malloy models

**Out of scope:**
- Vulnerabilities in underlying SQL engines (BigQuery, Snowflake, DuckDB, etc.) — report those upstream
- Issues in third-party npm dependencies — report to the dependency maintainer
- VS Code extension UI issues with no security impact

## Disclosure

We follow coordinated disclosure. Please give us a reasonable window to fix and notify affected users before making findings public. We will publish a GitHub Security Advisory once a fix is released.
