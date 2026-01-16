# @mcp-gateway/cli Features

## Implemented Commands

### 1. `mcp-gateway configure`
**Purpose**: Interactive token configuration with secure OS keyring storage

**Features**:
- Interactive prompts for service name, user ID, and token
- Secure password input (masked)
- Confirmation before saving
- Non-interactive mode for CI/CD (uses environment variables)
- Automatic fallback to memory if keyring fails
- Clear success/failure feedback

**Integration**:
- Uses `TokenVault` for secure storage
- Stores tokens in OS keyring (Keychain/Credential Manager/libsecret)
- Supports both interactive and automated workflows

### 2. `mcp-gateway status`
**Purpose**: Display security status and service information

**Features**:
- Shows storage type (keyring vs memory)
- Displays configured users
- Shows active sessions for a user
- Session details (ID, created, expires)
- JSON output for automation
- Service-specific status checks

**Integration**:
- Uses `TokenVault` to check token existence
- Uses `SessionManager` to get active sessions
- Supports both human-readable and JSON formats

### 3. `mcp-gateway rotate`
**Purpose**: Rotate sessions and optionally update tokens

**Features**:
- Creates new session for user
- Optional session cleanup (destroy all old sessions)
- Optional token update during rotation
- Interactive confirmation prompts
- Non-interactive mode for automation
- Session metadata tracking (rotation timestamp, previous session count)

**Integration**:
- Uses `SessionManager` for session lifecycle
- Uses `TokenVault` for token updates
- Maintains session metadata for audit trails

## Security Features

1. **Secure Token Storage**
   - OS keyring integration (encrypted at rest)
   - Memory fallback with clear warnings
   - Never stores tokens in plaintext files

2. **Session Management**
   - UUID-based session IDs (cryptographic randomness)
   - Automatic expiration tracking
   - User-bound sessions

3. **Safe Operations**
   - Confirmation prompts in interactive mode
   - Clear success/failure feedback
   - Error handling with helpful messages

## Test Coverage

All commands have comprehensive test coverage:
- **Configure**: 4 tests (storage, validation, fallback, updates)
- **Status**: 6 tests (token checking, sessions, storage type)
- **Rotate**: 5 tests (creation, destruction, metadata, token updates)

**Total**: 15 tests, all passing

## Usage Patterns

### Development Workflow
```bash
# 1. Configure tokens
mcp-gateway configure

# 2. Check status
mcp-gateway status --user-id dev-user

# 3. Work with API...

# 4. Rotate when needed
mcp-gateway rotate --user-id dev-user --destroy-all
```

### CI/CD Pipeline
```bash
export MCP_GATEWAY_TOKEN="secret-token"
mcp-gateway configure --service ci-service --user-id ci-user --non-interactive
mcp-gateway status --service ci-service --user-id ci-user --json
```

### Production Deployment
```bash
# Configure production tokens
mcp-gateway configure --service prod-api

# Regular session rotation
mcp-gateway rotate --user-id prod-user --destroy-all --non-interactive

# Monitor status
mcp-gateway status --user-id prod-user --json | jq '.activeSessions'
```

## Architecture

```
CLI Commands
    ↓
@mcp-gateway/core
    ├── TokenVault (storage)
    │   └── OS Keyring Integration
    ├── SessionManager (session)
    │   └── Session Lifecycle
    └── MCPAuthenticator (authenticator)
        └── Token Verification
```

## Future Enhancements

Potential additions for future phases:
- `mcp-gateway list` - List all configured services
- `mcp-gateway remove` - Remove service configuration
- `mcp-gateway validate` - Validate token with API
- `mcp-gateway export` - Export configuration (excluding secrets)
- `mcp-gateway import` - Import configuration
- Shell completions (bash, zsh, fish)
- Man pages for CLI commands
