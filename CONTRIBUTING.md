# Contributing to OpenClaw Remote

Thanks for your interest in contributing! This project is in early development and there's a lot of meaningful work to be done. Whether you're fixing a typo, squashing a bug, or building a whole new feature -- all contributions are welcome.

## Project Status

OpenClaw Remote is **actively being built**. The core architecture is in place but many features are incomplete, the security model hasn't been audited, and the plugin installation experience needs work. This means:

- **Breaking changes will happen.** We're not locked into any APIs yet.
- **Rough edges are expected.** If something seems wrong, it probably is -- file an issue or fix it.
- **Your input shapes the project.** Design decisions are still being made. Open a discussion before starting large features so we can align on the approach.

## Getting Started

1. Fork and clone the repo
2. `npm install`
3. `npm test` -- make sure all tests pass
4. `npm run build:check` -- make sure TypeScript and the build are clean
5. Pick something from [ROADMAP.md](ROADMAP.md) or the [issues](https://github.com/shaynhornik/openclaw-remote/issues)

## Development Workflow

```bash
# Start the Vite dev server
npm run dev

# Run tests in watch mode
npm run test:watch

# Type-check without building
npx tsc --noEmit

# Full check (types + build)
npm run build:check
```

## Pull Request Guidelines

### Before You Submit

- **Tests pass**: `npm test` -- all existing tests must pass
- **Types clean**: `npm run build:check` -- no TypeScript errors
- **New code has tests**: If you add logic (especially in `protocol/`, `plugin/`, or `stores/`), write tests for it
- **One thing per PR**: Keep PRs focused. A bug fix + a feature = two PRs.

### PR Format

- Title: brief description of what changed (e.g., "Fix WebSocket reconnection on auth failure")
- Body: explain **what** you changed and **why**. Link to an issue if one exists.
- If your change affects the UI, include a screenshot or short recording.

### Code Style

- TypeScript strict mode -- no `any` unless absolutely necessary
- Functional React components with hooks
- Zustand for state (see existing stores for patterns)
- Tailwind CSS for styling -- no CSS modules or styled-components
- Keep it simple. Don't over-abstract. Three similar lines are better than a premature helper.

## What to Work On

Check [ROADMAP.md](ROADMAP.md) for the full feature wishlist. Here are some good starting areas:

### Good First Issues

- Add screenshots to the README
- Improve error messages when the gateway connection fails
- Add more unit tests for protocol framing/parsing
- Fix any TODO comments in the codebase
- Improve mobile responsiveness in specific views

### Medium Effort

- File browser with directory tree navigation
- Notification system for approval requests
- Dark/light theme toggle
- Keyboard shortcuts for common actions
- Export usage data as CSV

### Large Features

- End-to-end encryption for sensitive config fields
- Role-based access control UI
- Multi-gateway support (connect to multiple gateways)
- Automated security audit tooling

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- OpenClaw version and browser/OS

## Security Issues

**Do not open a public issue for security vulnerabilities.** See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## Questions?

Open a [discussion](https://github.com/shaynhornik/openclaw-remote/discussions) or an issue tagged with `question`. No question is too basic.
