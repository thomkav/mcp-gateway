# Integration Patterns & Best Practices

Comprehensive guide to common integration patterns and best practices for MCP Gateway.

## Table of Contents

- [Quick Start Patterns](#quick-start-patterns)
- [Authentication Patterns](#authentication-patterns)
- [Authorization Patterns](#authorization-patterns)
- [Token Management Patterns](#token-management-patterns)
- [Error Handling Patterns](#error-handling-patterns)
- [Middleware Patterns](#middleware-patterns)
- [Testing Patterns](#testing-patterns)
- [Production Patterns](#production-patterns)

## Quick Start Patterns

### Minimal Secure Server

Simplest possible secure MCP server:

```typescript
import { SecureMCPServer } from '@mcp-gateway/server';

const server = new SecureMCPServer({
  name: 'my-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
});

server.registerTool({
  name: 'hello',
  description: 'Say hello',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    required: ['name'],
  },
  handler: async (params, context) => {
    const { name } = params as { name: string };
    return { message: `Hello, ${name}!` };
  },
});

const { token } = server.createSession('user-1', ['read']);
console.error(`Token: ${token}`);

await server.start();
```

### Single Service Integration

Integrate with one external API:

```typescript
import { SecureMCPServer } from '@mcp-gateway/server';

const server = new SecureMCPServer({
  name: 'github-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET,
  tokenVaultConfig: {
    serviceName: 'mcp-github',
  },
});

server.registerTool({
  name: 'list_repos',
  description: 'List GitHub repositories',
  inputSchema: { type: 'object', properties: {} },
  requiredScopes: ['github:read'],
  handler: async (params, context) => {
    const token = await context.tokenVault.getToken(
      context.auth.userId,
      'github'
    );

    const response = await fetch('https://api.github.com/user/repos', {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { repos: await response.json() };
  },
});

await server.start();
```

## Authentication Patterns

### Session with Custom Metadata

Create sessions with additional metadata:

```typescript
server.createSession(
  'user-123',
  ['read', 'write'],
  {
    loginTime: new Date(),
    ipAddress: '192.168.1.1',
    userAgent: 'Claude Code/1.0',
    loginMethod: 'oauth',
  }
);
```

### Session Lifecycle Management

```typescript
class SessionService {
  private server: SecureMCPServer;

  constructor(server: SecureMCPServer) {
    this.server = server;
  }

  login(userId: string, scopes: string[]): { token: string; sessionId: string } {
    const result = this.server.createSession(userId, scopes, {
      loginTime: new Date(),
    });

    console.log(`User ${userId} logged in: ${result.sessionId}`);
    return result;
  }

  logout(sessionId: string): void {
    const success = this.server.destroySession(sessionId);
    if (success) {
      console.log(`Session ${sessionId} destroyed`);
    }
  }

  rotateUserSessions(userId: string): void {
    const sessionManager = this.server.getSessionManager();
    // Get all sessions for user and destroy them
    // (Note: SessionManager doesn't have user lookup in current impl,
    // you'd need to track this separately or extend the manager)
  }
}
```

### Multi-User Server

Handle multiple users with different permissions:

```typescript
const server = new SecureMCPServer({
  name: 'multi-user-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET,
});

// Create sessions for different user types
const adminSession = server.createSession('admin-user', [
  'read',
  'write',
  'admin',
]);

const editorSession = server.createSession('editor-user', ['read', 'write']);

const viewerSession = server.createSession('viewer-user', ['read']);

console.log('Admin token:', adminSession.token);
console.log('Editor token:', editorSession.token);
console.log('Viewer token:', viewerSession.token);
```

## Authorization Patterns

### Hierarchical Scopes

Implement hierarchical scope checking:

```typescript
function hasScope(userScopes: string[], requiredScope: string): boolean {
  // Check exact match
  if (userScopes.includes(requiredScope)) {
    return true;
  }

  // Check wildcard (e.g., 'service:*' grants 'service:read')
  const [namespace] = requiredScope.split(':');
  if (userScopes.includes(`${namespace}:*`)) {
    return true;
  }

  return false;
}

server.registerTool({
  name: 'admin_tool',
  description: 'Admin operation',
  inputSchema: { type: 'object', properties: {} },
  customAuthCheck: (context) => {
    return hasScope(context.scope, 'admin:delete');
  },
  handler: async (params, context) => {
    // Admin logic
  },
});
```

### Resource-Level Authorization

Check if user owns the resource:

```typescript
interface ResourceOwnership {
  [resourceId: string]: string; // resourceId -> userId
}

const resourceOwners: ResourceOwnership = {
  'task-1': 'user-123',
  'task-2': 'user-456',
};

server.registerTool({
  name: 'update_task',
  description: 'Update a task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      title: { type: 'string' },
    },
    required: ['taskId'],
  },
  requiredScopes: ['tasks:write'],
  customAuthCheck: (context) => {
    // This doesn't have access to params, so we need to check in handler
    return true;
  },
  handler: async (params, context) => {
    const { taskId } = params as { taskId: string };

    // Check ownership
    if (resourceOwners[taskId] !== context.auth.userId) {
      throw new Error('Not authorized to modify this task');
    }

    // Update task...
    return { success: true };
  },
});
```

### Role-Based Access Control (RBAC)

Implement RBAC on top of scopes:

```typescript
enum Role {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  ADMIN = 'admin',
}

const roleScopes: Record<Role, string[]> = {
  [Role.VIEWER]: ['read'],
  [Role.EDITOR]: ['read', 'write'],
  [Role.ADMIN]: ['read', 'write', 'admin'],
};

const userRoles: Record<string, Role> = {
  'user-123': Role.ADMIN,
  'user-456': Role.EDITOR,
  'user-789': Role.VIEWER,
};

function createSessionForUser(userId: string) {
  const role = userRoles[userId] || Role.VIEWER;
  const scopes = roleScopes[role];

  return server.createSession(userId, scopes, { role });
}

// Usage
const { token } = createSessionForUser('user-123'); // Gets admin scopes
```

### Time-Based Authorization

Restrict access to certain hours:

```typescript
server.registerTool({
  name: 'critical_operation',
  description: 'Critical operation (business hours only)',
  inputSchema: { type: 'object', properties: {} },
  requiredScopes: ['admin'],
  customAuthCheck: (context) => {
    const hour = new Date().getHours();
    // Only allow 9 AM - 5 PM
    if (hour < 9 || hour >= 17) {
      return false;
    }
    return true;
  },
  handler: async (params, context) => {
    // Critical operation
  },
});
```

## Token Management Patterns

### Multi-Service Token Management

Manage tokens for multiple services:

```typescript
class TokenManager {
  private vault: TokenVault;

  constructor(vault: TokenVault) {
    this.vault = vault;
  }

  async configureUser(
    userId: string,
    services: Record<string, string>
  ): Promise<void> {
    for (const [service, token] of Object.entries(services)) {
      await this.vault.setToken(userId, service, token);
    }
  }

  async getUserServices(userId: string): Promise<string[]> {
    // This would require extending TokenVault to list services
    // For now, track separately
    const services = ['github', 'gitlab', 'vikunja'];
    const configured: string[] = [];

    for (const service of services) {
      const token = await this.vault.getToken(userId, service);
      if (token) {
        configured.push(service);
      }
    }

    return configured;
  }

  async rotateToken(
    userId: string,
    service: string,
    newToken: string
  ): Promise<void> {
    await this.vault.deleteToken(userId, service);
    await this.vault.setToken(userId, service, newToken);
  }
}

// Usage
const tokenManager = new TokenManager(server.getTokenVault());

await tokenManager.configureUser('user-123', {
  github: 'ghp_...',
  gitlab: 'glpat_...',
  vikunja: 'tk_...',
});
```

### Token Refresh Pattern

Handle token expiration and refresh:

```typescript
class RefreshableTokenClient {
  private vault: TokenVault;
  private userId: string;
  private service: string;
  private refreshFn: () => Promise<string>;

  constructor(
    vault: TokenVault,
    userId: string,
    service: string,
    refreshFn: () => Promise<string>
  ) {
    this.vault = vault;
    this.userId = userId;
    this.service = service;
    this.refreshFn = refreshFn;
  }

  async getToken(): Promise<string> {
    const token = await this.vault.getToken(this.userId, this.service);

    if (!token) {
      // Refresh and store
      const newToken = await this.refreshFn();
      await this.vault.setToken(this.userId, this.service, newToken);
      return newToken;
    }

    return token;
  }

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    // If 401, refresh and retry
    if (response.status === 401) {
      const newToken = await this.refreshFn();
      await this.vault.setToken(this.userId, this.service, newToken);

      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }

    return response;
  }
}
```

## Error Handling Patterns

### Centralized Error Handler

Create a centralized error handler:

```typescript
class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

async function handleToolCall<T>(
  toolName: string,
  context: SecurityContext,
  auditLogger: AuditLogger,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn();

    await auditLogger.log('tool_call', 'success', {
      userId: context.auth.userId,
      sessionId: context.auth.sessionId,
      resource: toolName,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await auditLogger.log('tool_call', 'error', {
      userId: context.auth.userId,
      sessionId: context.auth.sessionId,
      resource: toolName,
      metadata: { error: errorMessage },
    });

    // Don't leak sensitive information
    if (error instanceof MCPError) {
      throw error;
    }

    throw new MCPError('Internal server error', 'INTERNAL_ERROR', 500);
  }
}

// Usage in tool handler
server.registerTool({
  name: 'my_tool',
  description: 'My tool',
  inputSchema: { type: 'object', properties: {} },
  handler: async (params, context) => {
    return handleToolCall('my_tool', context, server.getAuditLogger(), async () => {
      // Tool logic that might throw
      throw new MCPError('Not found', 'NOT_FOUND', 404);
    });
  },
});
```

### Graceful Degradation

Provide fallbacks when services are unavailable:

```typescript
server.registerTool({
  name: 'get_data',
  description: 'Get data from external service',
  inputSchema: { type: 'object', properties: {} },
  requiredScopes: ['read'],
  handler: async (params, context) => {
    try {
      const token = await context.tokenVault.getToken(
        context.auth.userId,
        'external-service'
      );

      const response = await fetch('https://api.external.com/data', {
        headers: { Authorization: `Bearer ${token}` },
      });

      return { data: await response.json() };
    } catch (error) {
      // Fallback to cached data
      console.error('External service unavailable, using cache:', error);
      return {
        data: getCachedData(),
        cached: true,
        warning: 'External service unavailable, showing cached data',
      };
    }
  },
});
```

## Middleware Patterns

### Request Logging

Log all requests with timing:

```typescript
server.use(async (request, context) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  console.error(
    `[${requestId}] START ${request.method} - User: ${context.auth.userId}`
  );

  // Request continues (middleware can't intercept response)
  // but we can use audit logger to track completion

  return request;
});
```

### Request Validation

Validate requests before processing:

```typescript
server.use(async (request, context) => {
  // Block requests missing required headers
  if (!request.headers?.['x-client-version']) {
    console.error('Missing client version header');
    return null; // Block request
  }

  // Check client version
  const version = request.headers['x-client-version'];
  const [major] = version.split('.');

  if (parseInt(major) < 2) {
    console.error(`Unsupported client version: ${version}`);
    return null;
  }

  return request;
});
```

### Rate Limit Warnings

Warn users approaching rate limit:

```typescript
server.use(async (request, context) => {
  const rateLimiter = server.getRateLimiter(); // Assume we expose this
  const result = rateLimiter.checkLimit(context.auth.userId);

  if (result.remaining !== undefined && result.remaining < 10) {
    console.error(
      `Warning: User ${context.auth.userId} has ${result.remaining} requests remaining`
    );
  }

  return request;
});
```

## Testing Patterns

### Unit Testing Tools

Test tool handlers in isolation:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SecureMCPServer } from '@mcp-gateway/server';
import { TokenVault } from '@mcp-gateway/core/storage';

describe('create_task tool', () => {
  let server: SecureMCPServer;
  let mockContext: SecurityContext;

  beforeEach(() => {
    server = new SecureMCPServer({
      name: 'test-server',
      version: '1.0.0',
      jwtSecret: 'test-secret',
    });

    mockContext = {
      auth: {
        userId: 'test-user',
        sessionId: 'test-session',
        scope: ['write'],
      },
      tokenVault: new TokenVault({ fallbackToMemory: true }),
    };
  });

  it('creates task successfully', async () => {
    // Setup
    await mockContext.tokenVault.setToken('test-user', 'vikunja', 'test-token');

    server.registerTool({
      name: 'create_task',
      description: 'Create task',
      inputSchema: { type: 'object', properties: {} },
      handler: async (params, context) => {
        return { taskId: 123 };
      },
    });

    // Test would involve calling the handler directly
    // or testing through MCP protocol
  });
});
```

### Integration Testing

Test full authentication flow:

```typescript
describe('Authentication flow', () => {
  it('authenticates user and calls tool', async () => {
    const server = new SecureMCPServer({
      name: 'test-server',
      version: '1.0.0',
      jwtSecret: 'test-secret',
    });

    // Create session
    const { token } = server.createSession('user-1', ['read']);

    // Verify token
    const authenticator = server.getAuthenticator(); // Assume exposed
    const result = authenticator.verifyToken(token);

    expect(result.valid).toBe(true);
    expect(result.payload?.userId).toBe('user-1');
  });
});
```

## Production Patterns

### Configuration Management

Manage configuration across environments:

```typescript
interface ServerConfig {
  name: string;
  version: string;
  jwtSecret: string;
  sessionExpiryMs: number;
  tokenExpirySeconds: number;
  rateLimitConfig: {
    windowMs: number;
    maxRequests: number;
  };
}

const configs: Record<string, ServerConfig> = {
  development: {
    name: 'my-server-dev',
    version: '1.0.0',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    sessionExpiryMs: 60 * 60 * 1000, // 1 hour
    tokenExpirySeconds: 900, // 15 minutes
    rateLimitConfig: {
      windowMs: 60000,
      maxRequests: 1000, // Generous for testing
    },
  },
  production: {
    name: 'my-server',
    version: '1.0.0',
    jwtSecret: process.env.JWT_SECRET!,
    sessionExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
    tokenExpirySeconds: 3600, // 1 hour
    rateLimitConfig: {
      windowMs: 60000,
      maxRequests: 100,
    },
  },
};

const env = process.env.NODE_ENV || 'development';
const config = configs[env];

const server = new SecureMCPServer(config);
```

### Health Checks

Implement health check endpoint:

```typescript
server.registerTool({
  name: 'health_check',
  description: 'Check server health',
  inputSchema: { type: 'object', properties: {} },
  handler: async (params, context) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      sessions: server.getSessionManager().getActiveSessions?.() || 0,
    };

    return health;
  },
});
```

### Monitoring and Metrics

Track metrics for monitoring:

```typescript
class MetricsCollector {
  private requestCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  recordRequest(tool: string): void {
    const count = this.requestCounts.get(tool) || 0;
    this.requestCounts.set(tool, count + 1);
  }

  recordError(tool: string): void {
    const count = this.errorCounts.get(tool) || 0;
    this.errorCounts.set(tool, count + 1);
  }

  getMetrics() {
    return {
      requests: Object.fromEntries(this.requestCounts),
      errors: Object.fromEntries(this.errorCounts),
    };
  }
}

const metrics = new MetricsCollector();

server.use(async (request, context) => {
  metrics.recordRequest(request.method);
  return request;
});

// Expose metrics via tool
server.registerTool({
  name: 'metrics',
  description: 'Get server metrics',
  inputSchema: { type: 'object', properties: {} },
  requiredScopes: ['admin'],
  handler: async () => metrics.getMetrics(),
});
```

### Graceful Shutdown

Handle shutdown gracefully:

```typescript
let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.error('Shutting down gracefully...');

  // Stop accepting new requests
  server.use(async () => {
    throw new Error('Server is shutting down');
  });

  // Wait for in-flight requests (if tracking them)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Cleanup
  await server.stop();

  console.error('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await server.start();
```

### Audit Log Analysis

Analyze audit logs for security insights:

```typescript
function analyzeAuditLogs(auditLogger: AuditLogger) {
  const logs = auditLogger.getLogs();

  const authFailures = logs.filter(
    (log) => log.action.includes('token') && log.result === 'failure'
  );

  const rateLimitViolations = logs.filter(
    (log) => log.action === 'rate_limit_exceeded'
  );

  const suspiciousUsers = new Set<string>();

  // Find users with >5 auth failures
  const failuresByUser = new Map<string, number>();
  for (const log of authFailures) {
    if (log.userId) {
      const count = failuresByUser.get(log.userId) || 0;
      failuresByUser.set(log.userId, count + 1);

      if (count + 1 > 5) {
        suspiciousUsers.add(log.userId);
      }
    }
  }

  return {
    authFailures: authFailures.length,
    rateLimitViolations: rateLimitViolations.length,
    suspiciousUsers: Array.from(suspiciousUsers),
  };
}

// Run analysis periodically
setInterval(() => {
  const analysis = analyzeAuditLogs(server.getAuditLogger());
  if (analysis.suspiciousUsers.length > 0) {
    console.error('Suspicious activity detected:', analysis);
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

## Best Practices Summary

1. **Always use HTTPS in production** - Even though MCP uses stdio, protect network transport
2. **Rotate JWT secrets regularly** - Every 90 days minimum
3. **Use short-lived tokens** - 15-60 minutes, force re-authentication
4. **Implement least privilege** - Grant minimum scopes needed
5. **Log everything** - Use audit logger for all security events
6. **Monitor rate limits** - Alert on violations
7. **Test authorization** - Test with different scopes and users
8. **Handle errors gracefully** - Don't leak sensitive info in errors
9. **Use OS keyring** - Never store tokens in env vars or files
10. **Review audit logs** - Regular security reviews

## See Also

- [API Reference](./API.md) - Complete API documentation
- [Security Guide](./SECURITY.md) - Security architecture
- [Migration Guide](./MIGRATION.md) - Migrating from insecure MCP
- [Minimal Example](../examples/minimal/) - Simple integration
- [Vikunja Example](../examples/vikunja/) - Production integration
