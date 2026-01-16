# Minimal MCP Gateway Example

The simplest possible secure MCP server using MCP Gateway.

## What This Demonstrates

- Basic `SecureMCPServer` setup
- Registering a tool with authentication
- Creating sessions for users
- Running the server

## Setup

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run
pnpm start
```

## Code Walkthrough

### 1. Create Server

```typescript
import { SecureMCPServer } from '@mcp-gateway/server';

const server = new SecureMCPServer({
  name: 'minimal-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
});
```

**Default security settings:**
- Session expiry: 1 hour
- Token expiry: 15 minutes
- Rate limit: 100 requests/minute
- Token vault: In-memory (falls back from OS keyring)

### 2. Register a Tool

```typescript
server.registerTool({
  name: 'hello',
  description: 'Returns a greeting message',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name to greet' },
    },
    required: ['name'],
  },
  handler: async (params, context) => {
    // Access to:
    // - context.auth.userId
    // - context.auth.sessionId
    // - context.auth.scope
    // - context.tokenVault
    const { name } = params as { name: string };
    return { message: `Hello, ${name}!` };
  },
});
```

### 3. Create Session

```typescript
const { token, sessionId } = server.createSession(
  'user-123',           // User ID
  ['read', 'write']     // Scopes
);
```

This creates:
- A UUID-based session
- A JWT token bound to the session
- Audit log entry

### 4. Start Server

```typescript
await server.start();
```

The server uses stdio transport (standard input/output) to communicate with MCP clients.

## Testing

### Manual Test

```bash
# Start the server
pnpm start

# In another terminal, send MCP request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | pnpm start
```

### Using the Tool

```typescript
// MCP request to call the tool
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "hello",
    "arguments": {
      "name": "World"
    },
    "_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## Next Steps

### Add More Tools

```typescript
server.registerTool({
  name: 'goodbye',
  description: 'Say goodbye',
  inputSchema: { type: 'object', properties: {} },
  handler: async (params, context) => {
    return { message: 'Goodbye!' };
  },
});
```

### Add Scope Requirements

```typescript
server.registerTool({
  name: 'admin_tool',
  description: 'Admin-only tool',
  inputSchema: { type: 'object', properties: {} },
  requiredScopes: ['admin'],  // Only users with 'admin' scope can call
  handler: async (params, context) => {
    return { message: 'Admin action performed' };
  },
});
```

### Add Custom Authorization

```typescript
server.registerTool({
  name: 'delete_resource',
  description: 'Delete a resource',
  inputSchema: {
    type: 'object',
    properties: {
      resourceId: { type: 'string' },
    },
  },
  customAuthCheck: (context) => {
    // Custom logic: only allow user 'admin-1'
    return context.userId === 'admin-1';
  },
  handler: async (params, context) => {
    // Delete resource...
    return { success: true };
  },
});
```

### Add Middleware

```typescript
server.use(async (request, context) => {
  console.log(`Request: ${request.method} by ${context.auth.userId}`);
  return request; // or return null to block
});
```

### Use Token Vault

```typescript
server.registerTool({
  name: 'call_api',
  description: 'Call external API',
  inputSchema: { type: 'object', properties: {} },
  handler: async (params, context) => {
    // Get user's API token from secure vault
    const apiToken = await context.tokenVault.getToken(
      context.auth.userId,
      'external-api'
    );

    if (!apiToken) {
      throw new Error('API token not configured');
    }

    // Use token to call API...
    return { result: 'API called' };
  },
});
```

### Configure Rate Limiting

```typescript
const server = new SecureMCPServer({
  name: 'minimal-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET,
  rateLimitConfig: {
    windowMs: 60000,      // 1 minute window
    maxRequests: 30,      // 30 requests per window
  },
});
```

### Configure Session/Token Expiry

```typescript
const server = new SecureMCPServer({
  name: 'minimal-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET,
  sessionExpiryMs: 24 * 60 * 60 * 1000,  // 24 hours
  tokenExpirySeconds: 3600,               // 1 hour
});
```

## Security Notes

1. **Always set JWT_SECRET in production** - Don't use the default
2. **Sessions are in-memory** - They're lost when the server restarts
3. **Tokens are stateless** - They can't be revoked until they expire
4. **Use HTTPS** - In production, always use encrypted transport
5. **Audit logs** - Check logs regularly via `server.getAuditLogger()`

## See Also

- [Vikunja Example](../vikunja/) - Production-ready example with external API
- [API Documentation](../../docs/API.md) - Complete API reference
- [Security Guide](../../docs/SECURITY.md) - Security best practices
