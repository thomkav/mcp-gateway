# Migration Guide

Guide for migrating from insecure MCP servers to MCP Gateway.

## Table of Contents

- [Overview](#overview)
- [Migration Checklist](#migration-checklist)
- [Before & After](#before--after)
- [Step-by-Step Migration](#step-by-step-migration)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Overview

This guide helps you migrate existing MCP servers to use MCP Gateway's security framework. The migration adds:

- ✅ Authentication (JWT tokens)
- ✅ Session management
- ✅ Authorization (scope-based + custom)
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Secure token storage

**Estimated time:** 1-2 hours for a simple server, 4-8 hours for complex servers

## Migration Checklist

Use this checklist to track your migration:

### Planning
- [ ] Review current MCP server implementation
- [ ] Identify all tools and their security requirements
- [ ] Define scope model (read/write/admin)
- [ ] Determine rate limits
- [ ] Plan session/token expiry times

### Dependencies
- [ ] Add `@mcp-gateway/core` dependency
- [ ] Add `@mcp-gateway/server` dependency
- [ ] Update TypeScript config if needed

### Code Changes
- [ ] Replace `Server` with `SecureMCPServer`
- [ ] Convert tools to `SecureToolDefinition` format
- [ ] Add authentication to tool handlers
- [ ] Move API tokens to `TokenVault`
- [ ] Add session creation logic
- [ ] Add middleware (if needed)

### Configuration
- [ ] Set JWT secret (environment variable)
- [ ] Configure session expiry
- [ ] Configure token expiry
- [ ] Configure rate limits
- [ ] Configure token vault

### Testing
- [ ] Test authentication flow
- [ ] Test authorization (scopes)
- [ ] Test rate limiting
- [ ] Test session expiration
- [ ] Test with expired tokens
- [ ] Test with invalid tokens

### Deployment
- [ ] Update environment variables
- [ ] Configure user tokens via CLI
- [ ] Update MCP client configuration
- [ ] Monitor audit logs
- [ ] Set up alerting

## Before & After

### Before: Insecure MCP Server

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Insecure: API token in environment variable
const VIKUNJA_TOKEN = process.env.VIKUNJA_TOKEN;

const server = new Server(
  { name: 'vikunja-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Insecure: No authentication or authorization
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  if (toolName === 'create_task') {
    // Insecure: Token passed directly, no rate limiting, no audit log
    const response = await fetch('https://vikunja.example.com/api/v1/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VIKUNJA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request.params.arguments),
    });

    return { content: [{ type: 'text', text: await response.text() }] };
  }

  throw new Error('Unknown tool');
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Security Issues:**
- ❌ No authentication - anyone can call tools
- ❌ No authorization - no scope checks
- ❌ No rate limiting - vulnerable to abuse
- ❌ No audit logging - no forensics
- ❌ Token in environment variable - insecure storage
- ❌ Token passthrough - violates MCP security best practices

### After: Secure MCP Server

```typescript
import { SecureMCPServer } from '@mcp-gateway/server';

const server = new SecureMCPServer({
  name: 'vikunja-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET, // ✅ Secure JWT secret
  sessionExpiryMs: 24 * 60 * 60 * 1000,
  tokenExpirySeconds: 3600,
  rateLimitConfig: {
    windowMs: 60000,
    maxRequests: 60,
  },
  tokenVaultConfig: {
    serviceName: 'mcp-vikunja',
    fallbackToMemory: false,
  },
});

// ✅ Secure: Token stored in OS keyring, accessed via vault
server.registerTool({
  name: 'create_task',
  description: 'Create a new task',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['title'],
  },
  requiredScopes: ['vikunja:write'], // ✅ Authorization
  handler: async (params, context) => {
    // ✅ Get token from secure vault
    const apiToken = await context.tokenVault.getToken(
      context.auth.userId,
      'vikunja'
    );

    if (!apiToken) {
      throw new Error('Vikunja token not configured');
    }

    // ✅ Use token for API call
    const response = await fetch('https://vikunja.example.com/api/v1/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    return { task: await response.json() };
  },
});

// ✅ Authentication, authorization, rate limiting, audit logging all automatic
await server.start();
```

**Security Improvements:**
- ✅ Authentication via JWT tokens
- ✅ Authorization via required scopes
- ✅ Rate limiting (60 req/min)
- ✅ Audit logging automatic
- ✅ Token in OS keyring (encrypted at rest)
- ✅ MCP server issues own tokens (no passthrough)

## Step-by-Step Migration

### Step 1: Add Dependencies

Update `package.json`:

```json
{
  "dependencies": {
    "@mcp-gateway/core": "^1.0.0",
    "@mcp-gateway/server": "^1.0.0",
    "@modelcontextprotocol/sdk": "^0.6.0"
  }
}
```

Install:

```bash
pnpm install
```

### Step 2: Update Imports

**Before:**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
```

**After:**

```typescript
import { SecureMCPServer } from '@mcp-gateway/server';
// StdioServerTransport is handled internally
// No need for schema imports
```

### Step 3: Replace Server Initialization

**Before:**

```typescript
const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);
```

**After:**

```typescript
const server = new SecureMCPServer({
  name: 'my-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  // Optional: configure security settings
  sessionExpiryMs: 24 * 60 * 60 * 1000,
  tokenExpirySeconds: 3600,
  rateLimitConfig: {
    windowMs: 60000,
    maxRequests: 100,
  },
});
```

### Step 4: Convert Tool Handlers

**Before:**

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'my_tool') {
    // Tool logic here
    return { content: [{ type: 'text', text: 'Result' }] };
  }
});
```

**After:**

```typescript
server.registerTool({
  name: 'my_tool',
  description: 'Tool description',
  inputSchema: {
    type: 'object',
    properties: {
      // Define input parameters
    },
  },
  requiredScopes: ['read'], // Or ['write'], ['admin'], etc.
  handler: async (params, context) => {
    // Access user info via context.auth
    // Access token vault via context.tokenVault
    // Return result directly (not wrapped in content array)
    return { result: 'value' };
  },
});
```

### Step 5: Move API Tokens to TokenVault

**Before:**

```typescript
const API_TOKEN = process.env.API_TOKEN;

// In tool handler:
fetch(url, {
  headers: { Authorization: `Bearer ${API_TOKEN}` },
});
```

**After:**

```typescript
// No token in environment variable

// In tool handler:
const apiToken = await context.tokenVault.getToken(
  context.auth.userId,
  'service-name'
);

if (!apiToken) {
  throw new Error('API token not configured. Run: mcp-gateway configure');
}

fetch(url, {
  headers: { Authorization: `Bearer ${apiToken}` },
});
```

**Configure token via CLI:**

```bash
mcp-gateway configure --user-id user-123 --service service-name --token <token>
```

### Step 6: Update Server Startup

**Before:**

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

**After:**

```typescript
await server.start(); // stdio transport handled internally
```

### Step 7: Add Session Creation

For testing or initial setup, create a session:

```typescript
// After server initialization, before start()
const { token, sessionId } = server.createSession(
  'user-123',
  ['read', 'write'], // Scopes for this user
  { loginTime: new Date() } // Optional metadata
);

console.error(`Session created: ${sessionId}`);
console.error(`Token: ${token}`);
```

In production, create sessions via your authentication flow.

### Step 8: Update Environment Variables

**Before:**

```bash
export API_TOKEN=your-api-token
```

**After:**

```bash
export JWT_SECRET=your-secure-random-secret

# API tokens stored in OS keyring via CLI:
mcp-gateway configure
```

### Step 9: Update MCP Client Configuration

Update your MCP client (e.g., Claude Code) configuration to include the JWT token:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/server/dist/index.js"],
      "env": {
        "JWT_SECRET": "your-secure-random-secret"
      }
    }
  }
}
```

## Common Patterns

### Pattern 1: Read/Write Scopes

Define separate scopes for read and write operations:

```typescript
// Read-only tools
server.registerTool({
  name: 'list_items',
  description: 'List all items',
  inputSchema: { type: 'object', properties: {} },
  requiredScopes: ['service:read'],
  handler: async (params, context) => {
    // Read logic
  },
});

// Write tools
server.registerTool({
  name: 'create_item',
  description: 'Create a new item',
  inputSchema: { /* ... */ },
  requiredScopes: ['service:write'],
  handler: async (params, context) => {
    // Write logic
  },
});

// Grant read-only access to some users
server.createSession('read-only-user', ['service:read']);

// Grant full access to others
server.createSession('admin-user', ['service:read', 'service:write']);
```

### Pattern 2: Admin Tools

Protect admin tools with custom authorization:

```typescript
server.registerTool({
  name: 'delete_all_data',
  description: 'Delete all data (admin only)',
  inputSchema: { type: 'object', properties: {} },
  requiredScopes: ['admin'],
  customAuthCheck: (context) => {
    // Additional check: only specific users
    return ['admin-1', 'admin-2'].includes(context.userId);
  },
  handler: async (params, context) => {
    // Dangerous operation
  },
});
```

### Pattern 3: Multi-Service Integration

Support multiple external services:

```typescript
server.registerTool({
  name: 'sync_to_service',
  description: 'Sync data to external service',
  inputSchema: {
    type: 'object',
    properties: {
      service: { type: 'string', enum: ['github', 'gitlab', 'bitbucket'] },
      data: { type: 'object' },
    },
    required: ['service', 'data'],
  },
  requiredScopes: ['sync:write'],
  handler: async (params, context) => {
    const { service, data } = params as { service: string; data: unknown };

    // Get token for the specific service
    const apiToken = await context.tokenVault.getToken(
      context.auth.userId,
      service
    );

    if (!apiToken) {
      throw new Error(`${service} token not configured`);
    }

    // Use service-specific client
    if (service === 'github') {
      // GitHub logic
    } else if (service === 'gitlab') {
      // GitLab logic
    }
    // etc.
  },
});
```

### Pattern 4: Request Logging Middleware

Add logging for all requests:

```typescript
server.use(async (request, context) => {
  const startTime = Date.now();

  console.error(
    `[${new Date().toISOString()}] ${context.auth.userId} - ${request.method}`
  );

  // Continue request (middleware can't modify response, only block)
  return request;
});
```

### Pattern 5: IP-Based Blocking

Block requests from specific users:

```typescript
const BLOCKED_USERS = new Set(['banned-user-1', 'banned-user-2']);

server.use(async (request, context) => {
  if (BLOCKED_USERS.has(context.auth.userId)) {
    console.error(`Blocked request from ${context.auth.userId}`);
    return null; // Block request
  }
  return request;
});
```

## Troubleshooting

### Issue: "JWT_SECRET is required"

**Cause:** JWT secret not set in environment

**Solution:**

```bash
export JWT_SECRET=$(openssl rand -base64 32)
```

Or set in your `.env` file:

```bash
JWT_SECRET=your-secure-random-secret-here
```

### Issue: "API token not configured"

**Cause:** Token not stored in vault

**Solution:**

```bash
mcp-gateway configure --user-id your-user-id --service service-name
```

### Issue: "Keyring unavailable, using in-memory storage"

**Cause:** OS keyring not accessible

**Solution (macOS):**

Ensure Keychain Access is not locked.

**Solution (Linux):**

Install Secret Service:

```bash
# Ubuntu/Debian
sudo apt-get install gnome-keyring

# Fedora
sudo dnf install gnome-keyring
```

**Solution (Windows):**

Ensure Credential Manager service is running.

### Issue: "Rate limit exceeded"

**Cause:** User exceeded request quota

**Solution 1:** Wait for rate limit window to reset

**Solution 2:** Increase rate limits:

```typescript
rateLimitConfig: {
  windowMs: 60000,
  maxRequests: 200, // Increase from 100
}
```

### Issue: "Invalid or expired session"

**Cause:** Session expired or server restarted (sessions are in-memory)

**Solution:** Create a new session:

```typescript
const { token, sessionId } = server.createSession('user-id', ['read', 'write']);
```

### Issue: "Authorization failed: missing required scope"

**Cause:** User's session doesn't have required scope

**Solution:** Create session with correct scopes:

```typescript
server.createSession('user-id', ['service:read', 'service:write']);
```

### Issue: Token verification fails after server restart

**Cause:** Different JWT secret or sessions lost

**Solution:**

1. Ensure JWT_SECRET is consistent across restarts
2. Create new session if needed

### Issue: "Token vault connection failed"

**Cause:** TokenVault can't connect to OS keyring

**Solution:**

Enable fallback to in-memory (development only):

```typescript
tokenVaultConfig: {
  fallbackToMemory: true, // Allows in-memory fallback
}
```

## Rollback Plan

If you need to rollback:

1. **Keep old server code** - Don't delete until migration is stable
2. **Revert dependencies** - Go back to `@modelcontextprotocol/sdk` only
3. **Restore environment variables** - Put API tokens back in env vars
4. **Update MCP client config** - Point back to old server

## Next Steps

After migration:

1. **Review audit logs** - Check for security events
2. **Monitor rate limits** - Adjust if needed
3. **Test thoroughly** - Try all tools with different scopes
4. **Document scopes** - Write down what each scope means
5. **Train users** - Teach them how to configure tokens
6. **Set up alerting** - Monitor for security anomalies

## See Also

- [API Reference](./API.md) - Complete API documentation
- [Security Guide](./SECURITY.md) - Security architecture
- [Examples](./EXAMPLES.md) - Integration patterns
- [Minimal Example](../examples/minimal/) - Simple migration example
- [Vikunja Example](../examples/vikunja/) - Production migration example
