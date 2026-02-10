# Roadmap

OpenClaw Remote is in early development. This roadmap outlines planned and wanted features, roughly prioritized. If you want to work on something, open an issue to claim it so we can coordinate.

## Legend

- **Blocked** -- waiting on upstream OpenClaw features or design decisions
- **Help Wanted** -- ready to be worked on, contributor-friendly
- **In Progress** -- someone is actively working on it

---

## Priority 1: Stability & Installation

These need to be solid before anything else.

### Plugin Installation Experience
**Status: Help Wanted**

The current install flow (`git clone && npm install && npm run build && openclaw plugins install -l .`) is too many steps. Needs investigation into:

- [ ] `prepare` script to auto-build on `npm install` from git
- [ ] Pre-built releases (GitHub Releases with `dist/ui/` included)
- [ ] npm publishing so `openclaw plugins install openclaw-remote` just works
- [ ] Document whether `openclaw plugins install github:user/repo` runs build steps

### Plugin Path Resolution
**Status: Help Wanted**

The plugin uses multiple fallback strategies to locate `dist/ui/` at runtime because `jiti` (OpenClaw's TS loader) doesn't set `import.meta.url` reliably. This works but is fragile.

- [ ] Investigate how jiti resolves module paths and find a canonical solution
- [ ] Add integration test that installs the plugin into a mock extensions directory and verifies it finds the UI
- [ ] Consider embedding a `__UI_ROOT__` constant at build time

### WebSocket Connection Reliability
**Status: Help Wanted**

- [ ] Audit reconnection logic -- ensure clean recovery after gateway restart
- [ ] Handle protocol version mismatch gracefully (show "update required" instead of failing silently)
- [ ] Add connection health indicator with latency measurement
- [ ] Test behavior when gateway is behind a reverse proxy (nginx, Caddy)

---

## Priority 2: Security Hardening

**This project is not safe for production use until these are addressed.**

### Authentication & Authorization
**Status: Help Wanted**

- [ ] Audit the full auth flow: token validation, password hashing, session management
- [ ] Add rate limiting awareness (show lockout status in UI if gateway enforces it)
- [ ] Support OAuth/SSO if OpenClaw adds it upstream
- [ ] Session timeout and explicit logout

### Transport Security
**Status: Help Wanted**

- [ ] Document TLS requirements clearly (wss:// vs ws://)
- [ ] Warn in the UI when connected over unencrypted WebSocket on a non-localhost address
- [ ] CSP headers for the served HTML
- [ ] Subresource integrity for JS/CSS assets

### Device Identity
**Status: Help Wanted**

- [ ] Audit Ed25519 key generation and storage (currently localStorage)
- [ ] Key rotation mechanism
- [ ] Option to require device approval before granting access
- [ ] Document the threat model

### Configuration Security
**Status: Help Wanted**

- [ ] Never display secrets (tokens, passwords) in plain text by default
- [ ] Ensure config patches don't leak sensitive fields in transit
- [ ] Audit the raw JSON config editor for injection risks

---

## Priority 3: Feature Completeness

### Files Browser
**Status: Help Wanted**

The current Files view is minimal. Wanted:

- [ ] Directory tree navigation using `fs.list`/`fs.read`/`fs.write` RPCs (fall back to `agents.files.*` if unavailable)
- [ ] Breadcrumb navigation
- [ ] CodeMirror editor with syntax highlighting (component exists, needs integration)
- [ ] Create/rename/delete files
- [ ] File size and last-modified display

### Enhanced Config Editor
**Status: Help Wanted**

The Config view has basic model selection and raw JSON. Wanted:

- [ ] Full form-based editing for all known config sections
- [ ] Channel configuration with masked token fields
- [ ] Server settings (port, host, auth method)
- [ ] Validation before save (catch JSON errors, invalid values)
- [ ] Diff view showing what changed before confirming

### Notifications & Alerts
**Status: Help Wanted**

- [ ] Browser notifications for approval requests (with permission prompt)
- [ ] Toast notifications for connection events
- [ ] Audio alert option for urgent approvals
- [ ] Notification history/log

### Approval Workflow
**Status: Help Wanted**

- [ ] Approve/deny directly from notification
- [ ] Approval history with who approved what and when
- [ ] Bulk approve/deny
- [ ] Approval policies (auto-approve certain tool calls)

### Chat Improvements
**Status: Help Wanted**

- [ ] Markdown rendering in chat messages
- [ ] Code block syntax highlighting
- [ ] File attachment support (if gateway supports it)
- [ ] Chat history search
- [ ] Multi-session chat tabs

---

## Priority 4: Polish & UX

### Mobile Experience
**Status: Help Wanted**

- [ ] Audit all views for mobile responsiveness
- [ ] Swipe gestures for navigation
- [ ] Pull-to-refresh
- [ ] Offline mode with cached last-known state
- [ ] App icon and splash screen

### Accessibility
**Status: Help Wanted**

- [ ] Keyboard navigation for all interactive elements
- [ ] Screen reader support (ARIA labels, roles)
- [ ] High contrast mode
- [ ] Reduced motion support

### Theming
**Status: Help Wanted**

- [ ] Light theme (currently dark only)
- [ ] System theme detection (prefers-color-scheme)
- [ ] Custom accent colors

### Performance
**Status: Help Wanted**

- [ ] Profile and optimize re-renders in high-frequency views (Logs, Usage)
- [ ] Virtualized lists for large agent trees and log histories
- [ ] Lazy-load views that aren't immediately visible
- [ ] Bundle size audit and optimization

---

## Priority 5: Advanced Features

### Multi-Gateway Support
**Status: Blocked** (needs design)

- [ ] Save multiple gateway connections
- [ ] Switch between gateways
- [ ] Aggregate dashboard across gateways

### Role-Based Access Control
**Status: Blocked** (waiting on upstream OpenClaw RBAC)

- [ ] Read-only viewer mode
- [ ] Operator mode (can approve but not configure)
- [ ] Admin mode (full access)
- [ ] UI elements hidden/disabled based on role

### Audit Log
**Status: Help Wanted**

- [ ] Track all config changes with timestamps and user identity
- [ ] Track all approval decisions
- [ ] Export audit log

### Plugin Marketplace Integration
**Status: Blocked** (waiting on OpenClaw plugin ecosystem)

- [ ] Browse and install other plugins from the dashboard
- [ ] Plugin health status
- [ ] Plugin configuration UI

---

## How to Contribute

1. Pick something from this list (or propose your own idea)
2. Open an issue to discuss the approach
3. Fork, implement, test, PR
4. See [CONTRIBUTING.md](CONTRIBUTING.md) for details

No contribution is too small. Documentation improvements, test coverage, bug fixes, and typo corrections are all valuable.
