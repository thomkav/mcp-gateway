# Vikunja MCP Server Example

A production-ready secure MCP server for Vikunja task management integration.

## Features

- **Full Security Layer**: Authentication, session management, authorization
- **Scope-Based Access Control**: Separate `vikunja:read` and `vikunja:write` scopes
- **Rate Limiting**: 60 requests per minute per user
- **Secure Token Storage**: Vikunja API tokens stored in OS keyring
- **Audit Logging**: All operations logged for security review
- **Comprehensive Tool Set**: 8 tools for complete Vikunja integration

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

1. User configures Vikunja API token via CLI (stored in OS keyring)
2. Server creates session with JWT token
3. Each request verified against:
   - Valid JWT token
   - Active session
   - Required scopes
   - Rate limits

### Token Storage

```
OS Keyring (macOS: Keychain, Linux: Secret Service, Windows: Credential Vault)
└── Service: mcp-vikunja
    └── Account: user-123
        └── Password: vikunja-api-token
```

### Authorization Model

```
User Session
├── Scope: vikunja:read
│   ├── List projects
│   ├── Get project
│   ├── List tasks
│   └── Get task
└── Scope: vikunja:write
    ├── Create project
    ├── Create task
    ├── Update task
    └── Delete task
```

### Rate Limiting

- Window: 60 seconds
- Max requests: 60 per user
- Per-user enforcement

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
mcp-gateway configure
```

### "Rate limit exceeded"

Wait 60 seconds or adjust rate limits in `src/index.ts`:
```typescript
rateLimitConfig: {
  windowMs: 60000,
  maxRequests: 100, // Increase this
}
```

### "Invalid or expired session"

Create a new session - sessions expire after 24 hours by default.

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

## License

MIT
