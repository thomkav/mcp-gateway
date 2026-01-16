# Vikunja MCP Server Example

A production-ready secure MCP server for Vikunja task management integration.

## Features

### Security (Phase 3 Complete) ✅

- **Authentication**: JWT tokens with HMAC-SHA256 signatures
- **Session Management**: UUID v4 session IDs with 24-hour expiry
- **Authorization**: Granular scope-based access control with custom checks
- **Rate Limiting**: 60 requests per minute per user (Anthropic recommended)
- **Audit Logging**: Comprehensive logging with configurable handlers
- **Secure Token Storage**: Vikunja API tokens encrypted in OS keyring
- **Input Validation**: Protection against injection and parameter pollution
- **Defense in Depth**: Multiple security middleware layers

### Vikunja Integration

- **21 Total Tools**: Projects (5), Tasks (6), Buckets (4), Comments (2), Workflow helpers (4)
- **Advanced Features**: Kanban views, task filtering, workflow automation
- **Full CRUD Support**: Complete coverage of Vikunja API

### Compliance ✅

- ✅ Anthropic MCP Security Best Practices - Complete
- ✅ OWASP API Security Top 10 - Mitigated

## Prerequisites

1. Vikunja instance running (local or remote)
2. Vikunja API token
3. Node.js 18+ installed

## Setup

### 1. Install Dependencies

```bash
cd examples/vikunja
pnpm install
```

### 2. Build the Server

```bash
pnpm build
```

### 3. Configure Environment

```bash
# Set JWT secret for MCP Gateway
export MCP_JWT_SECRET="your-secure-random-secret-here"

# Set Vikunja URL (if not localhost:3456)
export VIKUNJA_URL="https://vikunja.example.com"
```

### 4. Configure Vikunja API Token

Use the MCP Gateway CLI to securely store your Vikunja API token:

```bash
# From project root
pnpm --filter @mcp-gateway/cli build
cd packages/cli

# Configure token
node dist/index.js configure
# Select service: vikunja
# Enter your Vikunja API token
# Enter your user ID (e.g., "user-123")
```

The token will be securely stored in your OS keyring.

## Usage

### Running the Server

```bash
pnpm start
```

### Using with Claude Code

Add to your Claude Code MCP configuration (`~/.config/claude-code/mcp.json`):

```json
{
  "mcpServers": {
    "vikunja": {
      "command": "node",
      "args": ["/path/to/mcp-gateway/examples/vikunja/dist/index.js"],
      "env": {
        "MCP_JWT_SECRET": "your-secure-random-secret-here",
        "VIKUNJA_URL": "http://localhost:3456"
      }
    }
  }
}
```

### Creating a Session

Before using the tools, create a session:

```typescript
import { SecureMCPServer } from '@mcp-gateway/server';

const server = new SecureMCPServer({...});

// Create session for a user
const { token, sessionId } = server.createSession(
  'user-123',
  ['vikunja:read', 'vikunja:write']
);

// Use this token in MCP requests
```

## Available Tools

### Read Operations (`vikunja:read` scope)

1. **vikunja_list_projects** - List all projects
2. **vikunja_get_project** - Get project details
3. **vikunja_list_tasks** - List tasks in a project
4. **vikunja_get_task** - Get task details

### Write Operations (`vikunja:write` scope)

5. **vikunja_create_project** - Create a new project
6. **vikunja_create_task** - Create a new task
7. **vikunja_update_task** - Update task (title, description, done status)
8. **vikunja_delete_task** - Delete a task

## Security Features

### Authentication Flow

1. User configures Vikunja API token via CLI (stored encrypted in OS keyring)
2. Server creates session with JWT token (HMAC-SHA256)
3. Each request verified against:
   - Valid JWT token signature and expiry
   - Active session (not expired)
   - Required scopes (read/write/delete)
   - Rate limits (60 req/min)
   - Input validation
4. All security events logged to audit log

### Scope-Based Authorization

Three permission levels with principle of least privilege:

| Scope | Operations | Required For |
|-------|-----------|--------------|
| `vikunja:read` | Read-only | list_projects, get_project, list_tasks, get_task, list_buckets, etc. |
| `vikunja:write` | Create/update | create_project, update_task, add_comment, etc. |
| `vikunja:delete` | Delete (destructive) | delete_project, delete_task, delete_bucket |

**Note**: Delete operations require BOTH `vikunja:write` AND `vikunja:delete` scopes.

### Token Storage

```
OS Keyring (Encrypted at Rest)
├── macOS: Keychain (Hardware AES-256)
├── Linux: Secret Service (AES-256 LUKS)
└── Windows: Credential Vault (DPAPI)
    └── Service: mcp-vikunja
        └── Account: <userId>
            └── Token: <vikunja-api-token>
```

### Rate Limiting

- **Algorithm**: Sliding window counter
- **Window**: 60 seconds (60000ms)
- **Max Requests**: 60 per user
- **Enforcement**: Per userId (shared across sessions)
- **Behavior**: Returns error when exceeded, resets after window

### Audit Logging

All security events logged with configurable handlers:

```
[AUDIT:INFO] timestamp | tool_call | success | user=alice | session=uuid | resource=vikunja_list_tasks
[AUDIT:WARN] timestamp | authorization_failed | failure | user=bob | {"error":"Missing vikunja:delete scope"}
```

**Logged Events**:
- Token issued/verified/expired/invalid
- Session created/destroyed/expired
- Authorization succeeded/failed
- Rate limit exceeded
- Tool execution success/error

### Security Middleware

1. **Request Logging**: All requests logged with user/session context
2. **Input Validation**: Validates numeric IDs, pagination params
3. **Attack Prevention**: Blocks parameter pollution (`__proto__`, etc.)

## Example Usage

### List Projects

```typescript
// Tool call with authentication
{
  "method": "tools/call",
  "params": {
    "name": "vikunja_list_projects",
    "_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Create Task

```typescript
{
  "method": "tools/call",
  "params": {
    "name": "vikunja_create_task",
    "arguments": {
      "projectId": 12,
      "title": "Implement feature X",
      "description": "Add new functionality for users"
    },
    "_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## Testing

```bash
pnpm test
```

## Troubleshooting

### "Vikunja API token not configured"

Run the configure command:
```bash
npx @mcp-gateway/cli configure
```

### "Rate limit exceeded"

You've exceeded 60 requests per minute. Wait for the rate limit window to reset (60 seconds). Check audit logs for the reset timestamp.

To adjust (not recommended for production):
```typescript
rateLimitConfig: {
  windowMs: 60000,
  maxRequests: 100, // Increase this
}
```

### "Invalid or expired token"

JWT tokens expire after 1 hour. Create a new session:
```typescript
const { token } = server.createSession('userId', ['vikunja:read', 'vikunja:write']);
```

### "Invalid or expired session"

Sessions expire after 24 hours. Create a new session with the same userId.

### "Authorization failed: Missing required scopes"

The operation requires a scope you don't have. Delete operations need BOTH `vikunja:write` AND `vikunja:delete`:
```typescript
server.createSession('userId', ['vikunja:read', 'vikunja:write', 'vikunja:delete']);
```

### Keyring not available

Ensure your OS keyring is unlocked:
- **macOS**: Keychain is unlocked
- **Linux**: GNOME Keyring or KWallet is running
- **Windows**: Credential Manager is accessible

The server is configured with `fallbackToMemory: false` for security, so it will fail if keyring is unavailable.

## Architecture

```
Claude Code
    ↓
MCP Gateway (this server)
├── Authentication (JWT tokens)
├── Session Management (24h expiry)
├── Authorization (scope checks)
├── Rate Limiting (60 req/min)
└── Audit Logging
    ↓
Token Vault (OS Keyring)
    ↓
Vikunja API
```

## Additional Resources

- **[SECURITY_CONFIG.md](./SECURITY_CONFIG.md)** - Complete security configuration guide
  - Pre-deployment checklist
  - Production configuration
  - Security monitoring
  - Incident response procedures
- **[MCP Gateway Security Documentation](../../docs/SECURITY.md)** - Framework security architecture
- **[Vikunja API Documentation](https://vikunja.io/docs/api/)** - Vikunja API reference
- **[Anthropic MCP Specification](https://modelcontextprotocol.io)** - MCP protocol spec

## License

MIT
