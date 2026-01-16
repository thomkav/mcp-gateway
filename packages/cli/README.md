# @mcp-gateway/cli

Command-line tool for MCP Gateway management.

## Installation

```bash
pnpm install
pnpm build
```

## Commands

### `mcp-gateway configure`

Interactive token configuration. Stores API tokens securely in the OS keyring.

```bash
# Interactive mode
mcp-gateway configure

# Non-interactive mode
mcp-gateway configure --service my-service --user-id user123 --non-interactive
# (requires MCP_GATEWAY_TOKEN environment variable)
```

**Options:**
- `-s, --service <name>` - Service name for the configuration
- `-u, --user-id <id>` - User ID for the token
- `--non-interactive` - Run in non-interactive mode (requires all options)

**Environment Variables (non-interactive mode):**
- `MCP_GATEWAY_TOKEN` - API token to store

### `mcp-gateway status`

Show security status and service information.

```bash
# Show general status
mcp-gateway status

# Show status for specific user
mcp-gateway status --user-id user123

# Show status for specific service
mcp-gateway status --service my-service --user-id user123

# Output as JSON
mcp-gateway status --user-id user123 --json
```

**Options:**
- `-s, --service <name>` - Service name to check (default: "mcp-gateway")
- `-u, --user-id <id>` - User ID to check status for
- `--json` - Output in JSON format

### `mcp-gateway rotate`

Rotate sessions and optionally update tokens.

```bash
# Rotate session for user
mcp-gateway rotate --user-id user123

# Rotate session and update token
mcp-gateway rotate --user-id user123 --update-token

# Destroy all sessions and create new one
mcp-gateway rotate --user-id user123 --destroy-all

# Non-interactive mode
mcp-gateway rotate --user-id user123 --update-token --non-interactive
# (requires MCP_GATEWAY_NEW_TOKEN environment variable for token update)
```

**Options:**
- `-s, --service <name>` - Service name (default: "mcp-gateway")
- `-u, --user-id <id>` - User ID to rotate sessions for (required)
- `--update-token` - Also update the API token
- `--destroy-all` - Destroy all existing sessions before creating new one
- `--non-interactive` - Run in non-interactive mode

**Environment Variables (non-interactive mode):**
- `MCP_GATEWAY_NEW_TOKEN` - New API token to store (when using `--update-token`)

## Security

- **Token Storage**: All tokens are stored securely in the OS keyring (Keychain on macOS, Credential Manager on Windows, libsecret on Linux)
- **Fallback**: If keyring access fails, tokens are stored in memory (shown in status output)
- **Sessions**: Session IDs are UUIDs with cryptographic randomness
- **No Plaintext Storage**: Tokens are never stored in plaintext files

## Examples

### Complete Setup Workflow

```bash
# 1. Configure token
mcp-gateway configure
# Follow prompts to enter service name, user ID, and token

# 2. Check status
mcp-gateway status --user-id user123

# 3. Rotate session when needed
mcp-gateway rotate --user-id user123 --destroy-all
```

### Automated/CI Usage

```bash
# Configure in CI/CD pipeline
export MCP_GATEWAY_TOKEN="your-api-token"
mcp-gateway configure --service my-service --user-id ci-user --non-interactive

# Check status
mcp-gateway status --service my-service --user-id ci-user --json

# Rotate session
mcp-gateway rotate --service my-service --user-id ci-user --non-interactive
```

## Development

```bash
# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## Integration

The CLI integrates with:
- **TokenVault** - Secure token storage in OS keyring
- **SessionManager** - Session lifecycle management
- **MCPAuthenticator** - Token generation and verification

See `@mcp-gateway/core` for more details on these components.
