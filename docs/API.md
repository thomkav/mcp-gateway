# API Reference

Complete API documentation for MCP Gateway packages.

## Table of Contents

- [@mcp-gateway/core](#mcp-gatewaycore)
- [@mcp-gateway/server](#mcp-gatewayserver)
- [@mcp-gateway/cli](#mcp-gatewaycli)
- [Type Definitions](#type-definitions)

## @mcp-gateway/core

Core security components for MCP Gateway.

### MCPAuthenticator

JWT token issuance and verification.

#### Constructor

```typescript
new MCPAuthenticator(config: AuthenticatorConfig)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| config.secret | `string` | HMAC secret for JWT signing (required, >256 bits recommended) |
| config.tokenExpirySeconds | `number` | Token TTL in seconds (default: 900 = 15 minutes) |
| config.issuer | `string` | JWT issuer claim (default: 'mcp-gateway') |

**Example:**

```typescript
import { MCPAuthenticator } from '@mcp-gateway/core';

const authenticator = new MCPAuthenticator({
  secret: process.env.JWT_SECRET,
  tokenExpirySeconds: 3600, // 1 hour
  issuer: 'my-mcp-server',
});
```

#### Methods

##### `issueToken(userId, sessionId, scope)`

Issues a new JWT token.

```typescript
issueToken(userId: string, sessionId: string, scope: string[]): string
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| userId | `string` | User identifier |
| sessionId | `string` | Session identifier (UUID) |
| scope | `string[]` | Array of scope strings (e.g., `['read', 'write']`) |

**Returns:** JWT token as string

**Example:**

```typescript
const token = authenticator.issueToken(
  'user-123',
  '550e8400-e29b-41d4-a716-446655440000',
  ['vikunja:read', 'vikunja:write']
);
```

##### `verifyToken(token)`

Verifies JWT token signature and claims.

```typescript
verifyToken(token: string): TokenVerificationResult
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| token | `string` | JWT token to verify |

**Returns:** `TokenVerificationResult`

```typescript
{
  valid: boolean;
  payload?: {
    userId: string;
    sessionId: string;
    scope: string[];
    iat: number;    // Issued at
    exp: number;    // Expires at
  };
  error?: string;
}
```

**Example:**

```typescript
const result = authenticator.verifyToken(token);
if (result.valid) {
  console.log(`User: ${result.payload.userId}`);
} else {
  console.error(`Invalid token: ${result.error}`);
}
```

---

### SessionManager

User session lifecycle management.

#### Constructor

```typescript
new SessionManager(config?: SessionManagerConfig)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| config.sessionExpiryMs | `number` | Session TTL in milliseconds (default: 3600000 = 1 hour) |
| config.cleanupIntervalMs | `number` | Cleanup interval in milliseconds (default: 60000 = 1 minute) |

**Example:**

```typescript
import { SessionManager } from '@mcp-gateway/core';

const sessionManager = new SessionManager({
  sessionExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
  cleanupIntervalMs: 5 * 60 * 1000,      // 5 minutes
});
```

#### Methods

##### `createSession(userId, metadata?)`

Creates a new session for a user.

```typescript
createSession(userId: string, metadata?: Record<string, unknown>): SessionData
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| userId | `string` | User identifier |
| metadata | `object` | Optional metadata object |

**Returns:** `SessionData`

```typescript
{
  sessionId: string;      // UUID v4
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}
```

**Example:**

```typescript
const session = sessionManager.createSession('user-123', {
  ipAddress: '192.168.1.1',
  userAgent: 'Claude Code',
});
```

##### `verifySession(sessionId)`

Verifies session exists and is not expired.

```typescript
verifySession(sessionId: string): SessionVerificationResult
```

**Returns:** `SessionVerificationResult`

```typescript
{
  valid: boolean;
  session?: SessionData;
  error?: string;
}
```

##### `destroySession(sessionId)`

Destroys a session (logout).

```typescript
destroySession(sessionId: string): boolean
```

**Returns:** `true` if session was destroyed, `false` if not found

##### `destroy()`

Stops cleanup timer and clears all sessions.

```typescript
destroy(): void
```

---

### RequestVerifier

Authorization rule enforcement.

#### Constructor

```typescript
new RequestVerifier()
```

**Example:**

```typescript
import { RequestVerifier } from '@mcp-gateway/core';

const verifier = new RequestVerifier();
```

#### Methods

##### `addRule(rule)`

Adds an authorization rule for a resource.

```typescript
addRule(rule: AuthorizationRule): void
```

**Parameters:**

```typescript
{
  resource: string;                                 // Resource identifier
  requiredScopes: string[];                         // Required scopes
  customCheck?: (context: AuthContext) => boolean;  // Custom logic
}
```

**Example:**

```typescript
verifier.addRule({
  resource: 'delete_task',
  requiredScopes: ['vikunja:write'],
  customCheck: (context) => context.userId !== 'guest',
});
```

##### `verify(resource, context)`

Verifies authorization for a resource.

```typescript
verify(resource: string, context: AuthContext): AuthorizationResult
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| resource | `string` | Resource identifier |
| context | `AuthContext` | Authorization context |

**Context:**

```typescript
{
  userId: string;
  sessionId: string;
  scope: string[];
}
```

**Returns:** `AuthorizationResult`

```typescript
{
  authorized: boolean;
  reason?: string;
}
```

**Example:**

```typescript
const result = verifier.verify('delete_task', {
  userId: 'user-123',
  sessionId: 'session-456',
  scope: ['vikunja:read', 'vikunja:write'],
});

if (!result.authorized) {
  throw new Error(result.reason);
}
```

---

### RateLimiter

Request rate limiting per user.

#### Constructor

```typescript
new RateLimiter(config: RateLimitConfig)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| config.windowMs | `number` | Time window in milliseconds |
| config.maxRequests | `number` | Max requests per window |

**Example:**

```typescript
import { RateLimiter } from '@mcp-gateway/core';

const rateLimiter = new RateLimiter({
  windowMs: 60000,      // 1 minute
  maxRequests: 100,     // 100 requests per minute
});
```

#### Methods

##### `checkLimit(userId)`

Checks if user is within rate limit.

```typescript
checkLimit(userId: string): RateLimitResult
```

**Returns:** `RateLimitResult`

```typescript
{
  allowed: boolean;
  remaining?: number;     // Remaining requests in window
  resetAt?: Date;         // Window reset time
}
```

**Example:**

```typescript
const result = rateLimiter.checkLimit('user-123');
if (!result.allowed) {
  throw new Error(`Rate limit exceeded. Try again after ${result.resetAt}`);
}
console.log(`${result.remaining} requests remaining`);
```

---

### AuditLogger

Security event logging.

#### Constructor

```typescript
new AuditLogger()
```

**Example:**

```typescript
import { AuditLogger } from '@mcp-gateway/core';

const auditLogger = new AuditLogger();
```

#### Methods

##### `log(action, result, details?)`

Logs a security event.

```typescript
log(
  action: string,
  result: 'success' | 'failure' | 'error',
  details?: {
    userId?: string;
    sessionId?: string;
    resource?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void>
```

**Example:**

```typescript
await auditLogger.log('tool_call', 'success', {
  userId: 'user-123',
  sessionId: 'session-456',
  resource: 'create_task',
  metadata: { taskId: 789 },
});
```

##### `getLogs(filters?)`

Retrieves audit logs with optional filtering.

```typescript
getLogs(filters?: {
  userId?: string;
  action?: string | RegExp;
  result?: 'success' | 'failure' | 'error';
  startTime?: Date;
  endTime?: Date;
}): AuditLogEntry[]
```

**Returns:** Array of `AuditLogEntry`

```typescript
{
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  result: 'success' | 'failure' | 'error';
  metadata?: Record<string, unknown>;
}
```

**Example:**

```typescript
// Get all failed authentications
const failures = auditLogger.getLogs({
  action: /token_verified/,
  result: 'failure',
});

// Get logs for specific user
const userLogs = auditLogger.getLogs({
  userId: 'user-123',
  startTime: new Date('2024-01-01'),
});
```

---

### TokenVault

Secure storage for third-party API tokens.

#### Constructor

```typescript
new TokenVault(config?: TokenVaultConfig)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| config.serviceName | `string` | Service name for keyring (default: 'mcp-gateway') |
| config.fallbackToMemory | `boolean` | Use in-memory if keyring unavailable (default: true) |

**Example:**

```typescript
import { TokenVault } from '@mcp-gateway/core/storage';

const vault = new TokenVault({
  serviceName: 'my-mcp-server',
  fallbackToMemory: false, // Fail if keyring unavailable
});
```

#### Methods

##### `setToken(userId, service, token)`

Stores a token for a user and service.

```typescript
setToken(userId: string, service: string, token: string): Promise<void>
```

**Example:**

```typescript
await vault.setToken('user-123', 'vikunja', 'api-token-xyz');
```

##### `getToken(userId, service)`

Retrieves a token.

```typescript
getToken(userId: string, service: string): Promise<string | null>
```

**Returns:** Token string or `null` if not found

**Example:**

```typescript
const token = await vault.getToken('user-123', 'vikunja');
if (!token) {
  throw new Error('Token not configured');
}
```

##### `deleteToken(userId, service)`

Deletes a token.

```typescript
deleteToken(userId: string, service: string): Promise<boolean>
```

**Returns:** `true` if deleted, `false` if not found

---

## @mcp-gateway/server

Secure MCP server wrapper.

### SecureMCPServer

Main server class with integrated security.

#### Constructor

```typescript
new SecureMCPServer(config: SecureMCPServerConfig)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| config.name | `string` | Server name |
| config.version | `string` | Server version |
| config.jwtSecret | `string` | JWT signing secret (required) |
| config.sessionExpiryMs | `number` | Session TTL in ms (default: 3600000) |
| config.tokenExpirySeconds | `number` | Token TTL in seconds (default: 900) |
| config.rateLimitConfig | `object` | Rate limit config (default: 100 req/min) |
| config.tokenVaultConfig | `object` | Token vault config |

**Example:**

```typescript
import { SecureMCPServer } from '@mcp-gateway/server';

const server = new SecureMCPServer({
  name: 'vikunja-mcp-server',
  version: '1.0.0',
  jwtSecret: process.env.JWT_SECRET,
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
```

#### Methods

##### `registerTool(tool)`

Registers a tool with security requirements.

```typescript
registerTool(tool: SecureToolDefinition): void
```

**Tool Definition:**

```typescript
{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;  // JSON Schema
  handler: ToolHandler;
  requiredScopes?: string[];
  customAuthCheck?: (context: AuthContext) => boolean;
}
```

**Handler Signature:**

```typescript
type ToolHandler = (
  params: unknown,
  context: SecurityContext
) => Promise<unknown>;
```

**Security Context:**

```typescript
{
  auth: {
    userId: string;
    sessionId: string;
    scope: string[];
  };
  tokenVault: TokenVault;
}
```

**Example:**

```typescript
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
  requiredScopes: ['vikunja:write'],
  handler: async (params, context) => {
    const { title, description } = params as {
      title: string;
      description?: string;
    };

    // Get API token from vault
    const apiToken = await context.tokenVault.getToken(
      context.auth.userId,
      'vikunja'
    );

    // Call external API
    const task = await createTaskInVikunja(apiToken, title, description);

    return { task };
  },
});
```

##### `unregisterTool(name)`

Unregisters a tool.

```typescript
unregisterTool(name: string): boolean
```

##### `use(middleware)`

Adds middleware to request processing pipeline.

```typescript
use(middleware: MiddlewareFunction): void
```

**Middleware Signature:**

```typescript
type MiddlewareFunction = (
  request: MCPRequest,
  context: SecurityContext
) => Promise<MCPRequest | null>;
```

Return `null` to block the request.

**Example:**

```typescript
// Request logging middleware
server.use(async (request, context) => {
  console.log(`${context.auth.userId} - ${request.method}`);
  return request;
});

// Request blocking middleware
server.use(async (request, context) => {
  if (context.auth.userId === 'blocked-user') {
    return null; // Block request
  }
  return request;
});
```

##### `createSession(userId, scope?, metadata?)`

Creates a new user session.

```typescript
createSession(
  userId: string,
  scope?: string[],
  metadata?: Record<string, unknown>
): { token: string; sessionId: string }
```

**Default scope:** `['read', 'write']`

**Example:**

```typescript
const { token, sessionId } = server.createSession(
  'user-123',
  ['vikunja:read', 'vikunja:write'],
  { loginTime: new Date() }
);
```

##### `destroySession(sessionId)`

Destroys a session (logout).

```typescript
destroySession(sessionId: string): boolean
```

##### `getTokenVault()`

Gets access to the token vault.

```typescript
getTokenVault(): TokenVault
```

##### `getAuditLogger()`

Gets access to the audit logger.

```typescript
getAuditLogger(): AuditLogger
```

##### `getSessionManager()`

Gets access to the session manager.

```typescript
getSessionManager(): SessionManager
```

##### `start()`

Starts the server with stdio transport.

```typescript
start(): Promise<void>
```

**Example:**

```typescript
await server.start();
console.log('Server running');
```

##### `stop()`

Stops the server and cleans up resources.

```typescript
stop(): Promise<void>
```

---

## @mcp-gateway/cli

Command-line tool for gateway management.

### Commands

#### `configure`

Configure API tokens interactively.

```bash
mcp-gateway configure [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `--user-id <id>` | User ID (prompts if not provided) |
| `--service <name>` | Service name (prompts if not provided) |
| `--token <token>` | Token value (prompts if not provided) |

**Example:**

```bash
# Interactive
mcp-gateway configure

# Non-interactive
mcp-gateway configure \
  --user-id user-123 \
  --service vikunja \
  --token my-api-token
```

#### `status`

Check security status for a user.

```bash
mcp-gateway status --user-id <id> [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `--user-id <id>` | User ID (required) |
| `--service <name>` | Check specific service token |

**Example:**

```bash
# Check all configured services
mcp-gateway status --user-id user-123

# Check specific service
mcp-gateway status --user-id user-123 --service vikunja
```

**Output:**

```
Security Status for user-123
============================

Configured Services:
  ✓ vikunja (token present)
  ✓ asana (token present)

Sessions: 2 active
Rate Limit: 45/100 requests in current window
```

#### `rotate`

Rotate sessions for a user.

```bash
mcp-gateway rotate --user-id <id> [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `--user-id <id>` | User ID (required) |
| `--destroy-all` | Destroy all sessions for user |
| `--session-id <id>` | Destroy specific session |

**Example:**

```bash
# Destroy all sessions
mcp-gateway rotate --user-id user-123 --destroy-all

# Destroy specific session
mcp-gateway rotate --user-id user-123 --session-id abc-123
```

---

## Type Definitions

### Core Types

```typescript
// Token payload
interface TokenPayload {
  userId: string;
  sessionId: string;
  scope: string[];
  iat: number;
  exp: number;
}

// Session data
interface SessionData {
  sessionId: string;      // UUID v4
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

// Authorization context
interface AuthContext {
  userId: string;
  sessionId: string;
  scope: string[];
}

// Audit log entry
interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  result: 'success' | 'failure' | 'error';
  metadata?: Record<string, unknown>;
}

// Rate limit config
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}
```

### Server Types

```typescript
// Security context (passed to tool handlers)
interface SecurityContext {
  auth: AuthContext;
  tokenVault: TokenVault;
}

// MCP request
interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// MCP response
interface MCPResponse {
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Tool handler
type ToolHandler = (
  params: unknown,
  context: SecurityContext
) => Promise<unknown>;

// Middleware
type MiddlewareFunction = (
  request: MCPRequest,
  context: SecurityContext
) => Promise<MCPRequest | null>;
```

### Security Event Types

```typescript
enum SecurityEventType {
  TOKEN_ISSUED = 'token_issued',
  TOKEN_VERIFIED = 'token_verified',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  SESSION_CREATED = 'session_created',
  SESSION_VERIFIED = 'session_verified',
  SESSION_EXPIRED = 'session_expired',
  SESSION_DESTROYED = 'session_destroyed',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  AUTHORIZATION_FAILED = 'authorization_failed',
  AUTHORIZATION_SUCCEEDED = 'authorization_succeeded',
}
```

## Error Handling

All methods may throw errors. Always wrap in try-catch:

```typescript
try {
  const result = await tool.handler(params, context);
  return result;
} catch (error) {
  await auditLogger.log('tool_call', 'error', {
    userId: context.auth.userId,
    resource: tool.name,
    metadata: { error: error.message },
  });
  throw error;
}
```

Common errors:

- `Authentication required` - No token provided
- `Invalid or expired token` - Token verification failed
- `Invalid or expired session` - Session not found or expired
- `Authorization failed` - Missing required scopes or custom check failed
- `Rate limit exceeded` - User exceeded request quota

## See Also

- [Security Guide](./SECURITY.md) - Security architecture and best practices
- [Migration Guide](./MIGRATION.md) - Migrating from insecure MCP
- [Examples](./EXAMPLES.md) - Integration patterns and examples
