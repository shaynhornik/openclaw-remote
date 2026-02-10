# Security Policy

## Current Status: Pre-Release -- Not Audited

**OpenClaw Remote has not undergone a security audit.** It is under active development and should be treated as inherently insecure until a stable release.

### Known Risk Areas

1. **Authentication**: Token and password authentication exists but has not been formally reviewed. There is no rate limiting, session expiration, or account lockout in the dashboard itself (the gateway may enforce some of these).

2. **Transport**: The WebSocket connection uses `ws://` (unencrypted) on localhost and `wss://` over the network. There is no enforcement of TLS -- if you connect over `ws://` on a non-localhost address, all traffic (including credentials) is sent in plain text.

3. **Device Identity**: Ed25519 keypairs are generated per device and stored in `localStorage`. Browser localStorage is accessible to any JavaScript running on the same origin. Key material is not encrypted at rest.

4. **Configuration Editor**: The raw JSON config editor sends configuration patches over WebSocket. Sensitive fields (API tokens, passwords) may be transmitted. The gateway may redact some fields, but this behavior is not guaranteed.

5. **Static File Serving**: The plugin serves built UI assets from the gateway's HTTP server. Directory traversal protections exist but have limited test coverage.

6. **Service Worker**: The PWA uses a Workbox service worker for caching. Stale cached assets could persist after security updates.

## What You Should Do

- **Do not expose OpenClaw Remote to the public internet** without a reverse proxy that enforces TLS and access control
- **Use Tailscale** or a VPN for remote access instead of port forwarding
- Treat the gateway's auth token as a secret -- do not share it in screenshots or logs
- Regularly update to the latest version

## Reporting Vulnerabilities

If you discover a security vulnerability, **please do not open a public issue**.

Instead, email **shaynhornik@gmail.com** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

You will receive a response within 72 hours. We will work with you to understand the issue, develop a fix, and coordinate disclosure.

## Security Contributions Welcome

If you have security expertise, we would especially appreciate help with:

- Auditing the WebSocket authentication flow
- Reviewing the static file server for path traversal vulnerabilities
- Evaluating the Ed25519 device identity implementation
- Adding CSP headers and subresource integrity
- Writing security-focused tests

See [ROADMAP.md](ROADMAP.md) for the full list of security-related tasks.
