# MCP Gateway Integration Guide

Complete guide for integrating new MCP servers into the MCP Gateway framework.

## Table of Contents

- [Integration Approaches](#integration-approaches)
- [Quick Start: Wrap Existing Server](#quick-start-wrap-existing-server)
- [Build New Secure Server](#build-new-secure-server)
- [Configuration](#configuration)
- [Token Management](#token-management)
- [Testing Your Integration](#testing-your-integration)
- [Deployment](#deployment)

## Integration Approaches

### Approach 1: Wrap Existing MCP Server (Fast)

**Use when:**
- You have an existing MCP server that works but is insecure
- You want to add security without rewriting everything
- The server uses token passthrough or no auth

**Time:** ~30 minutes to 2 hours

**Example:** Wrapping an existing Asana, Linear, or GitHub MCP server

### Approach 2: Build New Secure Server (Clean)

**Use when:**
- Starting from scratch
- You want full control over the implementation
- Building a production-grade integration

**Time:** 2-8 hours

**Example:** Our Vikunja example

---

## Quick Start: Wrap Existing Server

### Step 1: Identify the Existing Server Structure

Look at the existing server code to identify:

```typescript
// What tools does it expose?
const tools = [
  { name: 'tool1', handler: ... },
  { name: 'tool2', handler: ... },
];

// How does it authenticate?
// - Token in env vars? ❌ Insecure!
// - Hardcoded? ❌ Insecure!
// - Passed through from client? ❌ Insecure!
```

### Step 2: Create Wrapper Package

```bash
cd ~/dev/mcp-gateway/examples
mkdir my-service
cd my-service
pnpm init
```

**package.json:**
```json
{
  "name": "@mcp-gateway/example-myservice",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "mcp-myservice": "./dist/index.js"
  },
  "dependencies": {
    "@mcp-gateway/server": "workspace:*",
    "@mcp-gateway/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "@types/node": "^22.10.5"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

### Step 3: Create Secure Wrapper

**src/index.ts:**
```typescript
#!/usr/bin/env node
import { SecureMCPServer } from '@mcp-gateway/server';

async function main() {
  const server = new SecureMCPServer({
    name: 'myservice-mcp-server',
    version: '1.0.0',
    jwtSecret: process.env.MCP_JWT_SECRET!,
    tokenVaultConfig: {
      serviceName: 'mcp-myservice',
    },
  });

  // Import existing tools (or rewrite them)
  // OLD WAY (insecure):
  // const client = new MyServiceClient(process.env.API_TOKEN);

  // NEW WAY (secure):
  server.registerTool({
    name: 'old_tool_name',
    description: 'Description from old server',
    inputSchema: { /* same schema */ },
    requiredScopes: ['myservice:read'], // Add authorization
    handler: async (params, context) => {
      // Get token from secure vault instead of env
      const apiToken = await context.tokenVault.getToken(
        context.auth.userId,
        'myservice'
      );

      if (!apiToken) {
        throw new Error('API token not configured. Run: mcp-gateway configure');
      }

      // Initialize client with secure token
      const client = new MyServiceClient(apiToken);

      // Execute original logic
      return await originalHandler(params, client);
    },
  });

  await server.start();
}

main();
```

### Step 4: Port Each Tool

For each tool in the original server:

```typescript
// BEFORE (insecure):
async function getTasks() {
  const response = await fetch('https://api.example.com/tasks', {
    headers: { Authorization: `Bearer ${process.env.API_TOKEN}` }
  });
  return response.json();
}

// AFTER (secure):
server.registerTool({
  name: 'get_tasks',
  description: 'Get tasks from MyService',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
    },
  },
  requiredScopes: ['myservice:read'],
  handler: async (params, context) => {
    // ✅ Token from secure vault (per-user)
    const apiToken = await context.tokenVault.getToken(
      context.auth.userId,
      'myservice'
    );

    const response = await fetch('https://api.example.com/tasks', {
      headers: { Authorization: `Bearer ${apiToken}` }
    });

    return await response.json();
  },
});
```

### Step 5: Add Authorization

Add scope-based access control:

```typescript
server.registerTool({
  name: 'delete_task',
  description: 'Delete a task',
  inputSchema: { /* ... */ },
  requiredScopes: ['myservice:write'], // ✅ Requires write scope
  handler: async (params, context) => {
    // Only users with 'myservice:write' scope can call this
    // ...
  },
});

// Or custom authorization:
server.registerTool({
  name: 'admin_action',
  description: 'Admin-only action',
  inputSchema: { /* ... */ },
  requiredScopes: ['admin'],
  customAuthCheck: (context) => {
    // Custom logic: only specific users
    return context.userId.startsWith('admin-');
  },
  handler: async (params, context) => {
    // ...
  },
});
```

---

## Build New Secure Server

### Step 1: Create Project Structure

```bash
cd ~/dev/mcp-gateway/examples
mkdir my-new-service
cd my-new-service

# Create structure
mkdir -p src
touch src/index.ts src/client.ts src/tools.ts
```

### Step 2: Implement API Client

**src/client.ts:**
```typescript
export class MyServiceClient {
  private token: string | null = null;
  private baseUrl = 'https://api.myservice.com';

  setToken(token: string) {
    this.token = token;
  }

  async getTasks(projectId: string) {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}/tasks?project=${projectId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async createTask(data: { title: string; project: string }) {
    // Similar pattern...
  }
}
```

### Step 3: Define Tools

**src/tools.ts:**
```typescript
import { SecureToolDefinition } from '@mcp-gateway/server';
import { MyServiceClient } from './client.js';

export const tools: SecureToolDefinition[] = [
  {
    name: 'get_tasks',
    description: 'Get tasks from a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID',
        },
      },
      required: ['project_id'],
    },
    requiredScopes: ['myservice:read'],
    handler: async (params, client: MyServiceClient, context) => {
      const { project_id } = params as { project_id: string };
      const tasks = await client.getTasks(project_id);
      return { tasks };
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        project: { type: 'string', description: 'Project ID' },
      },
      required: ['title', 'project'],
    },
    requiredScopes: ['myservice:write'],
    handler: async (params, client: MyServiceClient, context) => {
      const data = params as { title: string; project: string };
      const task = await client.createTask(data);
      return { task };
    },
  },
];
```

### Step 4: Main Server Implementation

**src/index.ts:**
```typescript
#!/usr/bin/env node
import { SecureMCPServer } from '@mcp-gateway/server';
import { MyServiceClient } from './client.js';
import { tools } from './tools.js';

async function main() {
  const server = new SecureMCPServer({
    name: 'myservice-mcp-server',
    version: '1.0.0',
    jwtSecret: process.env.MCP_JWT_SECRET!,
    sessionExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
    tokenExpirySeconds: 3600,
    rateLimitConfig: {
      windowMs: 60000,
      maxRequests: 100,
    },
    tokenVaultConfig: {
      serviceName: 'mcp-myservice',
      fallbackToMemory: false,
    },
  });

  const client = new MyServiceClient();

  // Register all tools
  for (const tool of tools) {
    server.registerTool({
      ...tool,
      handler: async (params, context) => {
        // Get API token from vault
        const apiToken = await context.tokenVault.getToken(
          context.auth.userId,
          'myservice'
        );

        if (!apiToken) {
          throw new Error('API token not configured');
        }

        // Set token on client
        client.setToken(apiToken);

        // Execute tool handler
        return (tool.handler as any)(params, client, context);
      },
    });
  }

  // Add logging middleware
  server.use(async (request, context) => {
    console.error(`[${new Date().toISOString()}] ${context.auth.userId} - ${request.method}`);
    return request;
  });

  console.error('Starting MyService MCP server...');
  await server.start();
  console.error('Server running');

  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

## Configuration

### Environment Variables

Create `.env` file:

```bash
# Required
MCP_JWT_SECRET=your-strong-secret-key-here

# Optional (for initial setup/testing)
MYSERVICE_API_TOKEN=your-api-token
```

### Token Setup

Users configure their API tokens using the CLI:

```bash
# Interactive configuration
mcp-gateway configure

# Or programmatically
mcp-gateway configure --service myservice --token "user-api-token"
```

---

## Token Management

### Storing Tokens

```typescript
// In tool handler
const apiToken = await context.tokenVault.getToken(
  context.auth.userId,
  'myservice' // Service name
);

if (!apiToken) {
  throw new Error('API token not configured. Run: mcp-gateway configure');
}
```

### Multi-Service Support

If your server integrates with multiple APIs:

```typescript
// Get different tokens for different services
const githubToken = await context.tokenVault.getToken(userId, 'github');
const slackToken = await context.tokenVault.getToken(userId, 'slack');
const jiraToken = await context.tokenVault.getToken(userId, 'jira');
```

### Token Refresh

For services with expiring tokens:

```typescript
server.registerTool({
  name: 'api_call',
  handler: async (params, context) => {
    let token = await context.tokenVault.getToken(userId, 'myservice');

    try {
      return await callAPI(token);
    } catch (error) {
      if (error.status === 401) {
        // Token expired - refresh it
        token = await refreshToken(token);
        await context.tokenVault.storeToken(userId, 'myservice', token);
        return await callAPI(token);
      }
      throw error;
    }
  },
});
```

---

## Testing Your Integration

### Unit Tests

**src/tools.test.ts:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { tools } from './tools.js';

describe('MyService Tools', () => {
  it('should get tasks with valid project ID', async () => {
    const mockClient = {
      getTasks: vi.fn().mockResolvedValue([
        { id: '1', title: 'Task 1' },
      ]),
    };

    const mockContext = {
      auth: { userId: 'user-123', sessionId: 'session-456', scope: ['myservice:read'] },
      tokenVault: {} as any,
    };

    const result = await tools[0].handler(
      { project_id: 'proj-1' },
      mockClient as any,
      mockContext
    );

    expect(result.tasks).toHaveLength(1);
    expect(mockClient.getTasks).toHaveBeenCalledWith('proj-1');
  });
});
```

### Integration Tests

Test the full server:

```typescript
import { SecureMCPServer } from '@mcp-gateway/server';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyService MCP Server Integration', () => {
  let server: SecureMCPServer;

  beforeEach(() => {
    server = new SecureMCPServer({
      name: 'test-server',
      version: '1.0.0',
      jwtSecret: 'test-secret',
    });
    // Register tools...
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should create session and call tool', async () => {
    const { token, sessionId } = server.createSession('user-123', ['myservice:read']);

    // Simulate MCP tool call...
    expect(token).toBeDefined();
  });
});
```

---

## Deployment

### 1. Build

```bash
cd ~/dev/mcp-gateway
pnpm build
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "myservice": {
      "command": "node",
      "args": [
        "/Users/yourusername/dev/mcp-gateway/examples/my-service/dist/index.js"
      ],
      "env": {
        "MCP_JWT_SECRET": "your-production-secret"
      }
    }
  }
}
```

### 3. Configure User Tokens

```bash
# User runs this once
mcp-gateway configure --service myservice --token "their-api-token"
```

### 4. Create User Session

Either:

**A) Programmatically in server:**
```typescript
// One-time session creation for user
const { token } = server.createSession('user-id', ['myservice:read', 'myservice:write']);
// User stores this token
```

**B) Via authentication endpoint:**
```typescript
// Add an authentication tool
server.registerTool({
  name: 'authenticate',
  description: 'Create user session',
  inputSchema: {
    type: 'object',
    properties: {
      username: { type: 'string' },
      password: { type: 'string' },
    },
  },
  handler: async (params, context) => {
    // Verify username/password
    if (validCredentials(params)) {
      const { token } = server.createSession(
        params.username,
        ['myservice:read', 'myservice:write']
      );
      return { token };
    }
    throw new Error('Invalid credentials');
  },
});
```

---

## Common Patterns

### Pattern 1: Read-Only Tools

```typescript
{
  name: 'get_data',
  requiredScopes: ['myservice:read'],
  handler: async (params, context) => {
    // Only users with read scope can access
  }
}
```

### Pattern 2: Write Tools

```typescript
{
  name: 'create_item',
  requiredScopes: ['myservice:write'],
  handler: async (params, context) => {
    // Only users with write scope
  }
}
```

### Pattern 3: Admin Tools

```typescript
{
  name: 'delete_all',
  requiredScopes: ['admin'],
  customAuthCheck: (context) => context.userId.startsWith('admin-'),
  handler: async (params, context) => {
    // Only admins
  }
}
```

### Pattern 4: Error Handling

```typescript
server.use(async (request, context) => {
  try {
    return request;
  } catch (error) {
    await context.auditLogger.log('request_error', 'error', {
      userId: context.auth.userId,
      error: error.message,
    });
    throw error;
  }
});
```

---

## Checklist

Before deploying your integration:

- [ ] All tools registered with appropriate scopes
- [ ] Tokens stored in secure vault (not env vars)
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Error handling implemented
- [ ] Tests written and passing
- [ ] Documentation created
- [ ] MCP JWT secret is strong and secure
- [ ] Token vault service name is unique
- [ ] Session expiry configured appropriately

---

## Next Steps

1. **Test locally:** Run your server and test all tools
2. **Add to Claude Desktop:** Configure in `claude_desktop_config.json`
3. **Monitor:** Check audit logs for security events
4. **Iterate:** Add more tools and refine scopes

See also:
- [docs/EXAMPLES.md](./EXAMPLES.md) - More integration patterns
- [docs/SECURITY.md](./SECURITY.md) - Production deployment
- [docs/API.md](./API.md) - Complete API reference
