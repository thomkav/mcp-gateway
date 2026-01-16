# MCP Gateway

**Security gateway for Model Context Protocol servers**

A production-ready security framework that adds authentication, session management, authorization, and audit logging to MCP servers - compliant with [Anthropic's MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices).

## Features

- ✅ **No Token Passthrough** - MCP server issues its own tokens (not third-party passthroughs)
- ✅ **Secure Sessions** - UUID-based, user-bound sessions with automatic expiration
- ✅ **Request Verification** - All inbound requests verified with authorization
- ✅ **Rate Limiting** - Per-user rate limits to prevent abuse
- ✅ **Audit Logging** - Comprehensive security event logging
- ✅ **Secure Storage** - Tokens stored in OS keyring (encrypted at rest)

## Architecture

```
MCP Gateway sits between Claude Code and third-party APIs:

Claude Code (MCP Client)
        ↓
MCP Gateway (Security Layer)
    - Authentication
    - Session Management
    - Authorization & Rate Limiting
    - Audit Logging
        ↓
Third-Party APIs (Vikunja, Asana, etc.)
```

## Packages

| Package | Description |
|---------|-------------|
| `@mcp-gateway/core` | Core security components (auth, sessions, verification) |
| `@mcp-gateway/server` | Secure MCP server wrapper |
| `@mcp-gateway/storage` | Secure token storage (OS keyring integration) |

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run with coverage
pnpm test:coverage
```

## Examples

See `examples/` directory for complete implementations:
- **Vikunja** - Secure Vikunja MCP server
- **Minimal** - Minimal example showing core concepts

## Security Compliance

This framework addresses all requirements from Anthropic's MCP Security Best Practices:

| Requirement | Implementation |
|-------------|----------------|
| No token passthrough | ✅ MCP server issues own tokens |
| Token validation | ✅ All tokens verified to be issued by MCP server |
| Secure session IDs | ✅ UUIDs with cryptographic randomness |
| User binding | ✅ Sessions format `<user_id>:<session_id>` |
| Request verification | ✅ All inbound requests verified |
| Rate limiting | ✅ Per-user limits enforced |
| Audit logging | ✅ All security events logged |

## Documentation

- [Security Architecture](./docs/SECURITY.md)
- [API Reference](./docs/API.md)
- [Migration Guide](./docs/MIGRATION.md)

## License

MIT
