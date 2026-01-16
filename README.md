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
| `@mcp-gateway/cli` | Command-line tool for gateway management |

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

## CLI Usage

The `@mcp-gateway/cli` package provides command-line tools for managing the MCP Gateway:

```bash
# Configure tokens (interactive)
mcp-gateway configure

# Check security status
mcp-gateway status --user-id your-user-id

# Rotate sessions
mcp-gateway rotate --user-id your-user-id --destroy-all

# See all available commands
mcp-gateway --help
```

See [`packages/cli/README.md`](./packages/cli/README.md) for detailed CLI documentation.

## Examples

Complete working examples demonstrating MCP Gateway integration:

- **[Minimal Example](./examples/minimal/)** - Bare-bones integration showing core concepts
- **[Vikunja Example](./examples/vikunja/)** - Production-ready secure Vikunja MCP server

Each example includes:
- ✅ Full source code with TypeScript
- ✅ Detailed README with setup instructions
- ✅ Security best practices implementation
- ✅ Ready to run and customize

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

### Core Documentation

- **[Security Architecture](./docs/SECURITY.md)** - Comprehensive security guide including:
  - Architecture diagrams
  - Threat model and attack scenarios
  - Security components deep-dive
  - Compliance checklist (Anthropic MCP Security Best Practices, OWASP API Top 10)
  - Production deployment best practices
  - Audit logging and monitoring

- **[API Reference](./docs/API.md)** - Complete API documentation for:
  - `@mcp-gateway/core` - All security components with examples
  - `@mcp-gateway/server` - SecureMCPServer class and tool registration
  - `@mcp-gateway/cli` - Command-line interface reference
  - Type definitions and interfaces

- **[Migration Guide](./docs/MIGRATION.md)** - Step-by-step guide for:
  - Migrating from insecure MCP servers
  - Before/after code comparisons
  - Common migration patterns
  - Troubleshooting and rollback strategies

- **[Integration Patterns & Best Practices](./docs/EXAMPLES.md)** - Comprehensive guide to:
  - Quick start patterns
  - Authentication and authorization patterns
  - Token management strategies
  - Error handling best practices
  - Middleware patterns
  - Testing strategies
  - Production deployment patterns

## License

MIT
