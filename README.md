# OpenClaw Remote

> **Early Development -- Not Production Ready**
>
> This project is under active development and **should be considered a security risk** until it reaches a stable release. Authentication, authorization, and transport security have not been fully audited. **Do not expose this to the public internet** without understanding the risks. See [SECURITY.md](SECURITY.md) for details.

A real-time monitoring and control dashboard for [OpenClaw](https://github.com/openclaw) gateways. Installs as an OpenClaw plugin and serves a full-featured PWA directly from the gateway's HTTP server -- no separate infrastructure required.

## Features

- **Dashboard** -- Connection status, agent counts, active clients, pending approvals, token usage at a glance
- **Agent Tree** -- Hierarchical visualization of agents with parent-child relationships, status, model, and uptime
- **Live Logs** -- Real-time log streaming with level filtering (debug/info/warn/error)
- **Chat** -- Interactive chat with streaming responses and tool call tracking
- **Sessions** -- Browse active sessions with agent counts and activity timestamps
- **Channels** -- Status overview of configured communication channels (Discord, Slack, Telegram, etc.)
- **Usage Analytics** -- Token usage charts with time period filtering, cost breakdowns by model/session/agent
- **Cron Jobs** -- View and manage scheduled jobs with execution history
- **Configuration** -- Edit gateway config with model dropdowns, fallback ordering, agent settings, and a raw JSON editor
- **Diagnostics** -- Built-in health checks for gateway, security, agent connectivity, and configuration
- **Mobile Access** -- PWA with QR code for quick phone setup via Tailscale
- **Device Identity** -- Ed25519 keypair per device for cryptographic client identification

## Screenshots

*Coming soon -- contributors welcome to add screenshots.*

## Requirements

- [OpenClaw](https://github.com/openclaw) gateway **>= 2026.2.0** with plugin support
- Node.js >= 18 (for building)

## Installation

### From GitHub (recommended during development)

```bash
# Clone and build
git clone https://github.com/shaynhornik/openclaw-remote.git
cd openclaw-remote
npm install
npm run build

# Install into OpenClaw
openclaw plugins install -l .
```

After installing, **restart your OpenClaw gateway**. The dashboard will be available at:

```
http://<gateway-host>:18789/remote/
```

### Updating

```bash
cd openclaw-remote
git pull
npm install
npm run build
openclaw plugins install -l .
```

Then restart the gateway.

## Development

```bash
# Install dependencies
npm install

# Start Vite dev server (standalone, connects to gateway via WebSocket)
npm run dev

# Run tests
npm test

# Type-check + build
npm run build:check

# Lint
npm run lint
```

### Project Structure

```
src/
  plugin/           # OpenClaw plugin entry point (loaded by gateway via jiti)
    index.ts         # Plugin registration: HTTP handler, RPC methods, commands
    serve-ui.ts      # Static file server for the built SPA
  protocol/          # WebSocket protocol v3: framing, connection, device auth
  stores/            # Zustand state stores (agents, sessions, usage, etc.)
  hooks/             # React hooks (useRequest, useEventStream, useGateway)
  views/             # Page-level React components (Dashboard, Logs, Chat, etc.)
  components/        # Shared UI components (Badge, StatusDot, JsonViewer, etc.)
  main.tsx           # App entry point with same-origin gateway detection
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 |
| Language | TypeScript 5.7 |
| Bundler | Vite 6 |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 2 |
| Editor | CodeMirror 6 |
| Crypto | @noble/ed25519 |
| PWA | vite-plugin-pwa + Workbox |
| Tests | Vitest 3 |

### Running Tests

```bash
# Run once
npm test

# Watch mode
npm run test:watch
```

Tests cover the protocol layer, plugin HTTP server, MIME types, path traversal prevention, cache headers, and security headers.

## How It Works

OpenClaw Remote is an **OpenClaw plugin** that:

1. **Registers an HTTP handler** on the gateway's existing HTTP server to serve the React SPA at `/remote/` (configurable via `basePath`)
2. The SPA connects back to the **same host** via WebSocket (protocol v3) -- no CORS, no proxy, no extra ports
3. **Registers an RPC method** (`remote.ping`) for health checks
4. **Registers a chat command** (`/remote`) that prints the dashboard URL

The built UI assets are served with proper cache headers (immutable for hashed assets, no-cache for index.html) and security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy).

## Contributing

We actively welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [ROADMAP.md](ROADMAP.md) for a list of wanted features.

This is a young project with lots of low-hanging fruit -- a great opportunity to make a meaningful impact early.

## License

[MIT](LICENSE)
