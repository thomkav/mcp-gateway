# @workspace-hub/mcp-security

Security foundation package for MCP (Model Context Protocol) servers, providing authentication, session management, authorization, and secure storage.

## Features

- **MCPAuthenticator**: JWT-based authentication with token issuance and verification
- **SessionManager**: UUID-based user session management with expiry tracking
- **RequestVerifier**: Rule-based authorization for resource access
- **RateLimiter**: Token bucket rate limiting to prevent abuse
- **AuditLogger**: Security event logging for compliance and debugging
- **TokenVault**: Secure token storage with OS keyring integration

## Installation

```bash
pnpm add @workspace-hub/mcp-security
```

## Usage

### MCPAuthenticator

```typescript
import { MCPAuthenticator } from '@workspace-hub/mcp-security';

const authenticator = new MCPAuthenticator({
  secret: process.env.JWT_SECRET!,
  tokenExpirySeconds: 3600, // 1 hour
  issuer: 'my-mcp-server',
});

// Issue a token
const token = authenticator.issueToken('user123', 'session456', ['read', 'write']);

// Verify a token
const result = authenticator.verifyToken(token);
if (result.valid) {
  console.log('User:', result.payload?.userId);
  console.log('Scopes:', result.payload?.scope);
}

// Refresh a token
const newToken = authenticator.refreshToken(token);
```

### SessionManager

```typescript
import { SessionManager } from '@workspace-hub/mcp-security';

const sessionManager = new SessionManager({
  sessionExpiryMs: 3600000, // 1 hour
  cleanupIntervalMs: 300000, // 5 minutes
});

// Create a session
const session = sessionManager.createSession('user123', {
  role: 'admin',
  ip: '127.0.0.1',
});

// Verify a session
const verification = sessionManager.verifySession(session.sessionId);
if (verification.valid) {
  console.log('Session is active');
}

// Extend session
sessionManager.extendSession(session.sessionId);

// Destroy session
sessionManager.destroySession(session.sessionId);
```

### RequestVerifier

```typescript
import { RequestVerifier } from '@workspace-hub/mcp-security';

const verifier = new RequestVerifier();

// Add authorization rules
verifier.addRule({
  resource: 'projects',
  requiredScopes: ['read'],
});

verifier.addRule({
  resource: 'admin',
  requiredScopes: ['admin'],
  customCheck: (context) => context.userId.startsWith('admin-'),
});

// Verify access
const context = {
  userId: 'user123',
  sessionId: 'session456',
  scope: ['read', 'write'],
};

const result = verifier.verify('projects', context);
if (result.authorized) {
  console.log('Access granted');
} else {
  console.log('Access denied:', result.reason);
}
```

### RateLimiter

```typescript
import { RateLimiter } from '@workspace-hub/mcp-security';

const rateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100,
});

// Check rate limit
const result = rateLimiter.checkLimit('user123');
if (result.allowed) {
  console.log('Request allowed, remaining:', result.remaining);
} else {
  console.log('Rate limit exceeded, reset at:', new Date(result.resetAt));
}
```

### AuditLogger

```typescript
import { AuditLogger, SecurityEventType } from '@workspace-hub/mcp-security';

const logger = new AuditLogger({
  maxEntries: 10000,
  onLog: async (entry) => {
    // Send to external logging service
    await externalLogger.log(entry);
  },
});

// Log events
await logger.logAuthSuccess('user123', 'session456');
await logger.logAuthFailure('Invalid credentials');
await logger.logAuthorizationCheck('user123', 'session456', 'projects', 'success');
await logger.logRateLimitExceeded('user123');

// Query logs
const recentFailures = logger.getFailedEntries(50);
const userLogs = logger.getUserEntries('user123');
```

### TokenVault

```typescript
import { TokenVault } from '@workspace-hub/mcp-security';

const vault = new TokenVault({
  serviceName: 'my-mcp-server',
  fallbackToMemory: true, // Fallback to memory if keyring unavailable
});

// Store a token
await vault.store('user123-token', token);

// Retrieve a token
const storedToken = await vault.retrieve('user123-token');

// Check if token exists
const exists = await vault.exists('user123-token');

// Delete a token
await vault.delete('user123-token');
```

## Complete Example

```typescript
import {
  MCPAuthenticator,
  SessionManager,
  RequestVerifier,
  RateLimiter,
  AuditLogger,
  TokenVault,
} from '@workspace-hub/mcp-security';

// Initialize components
const authenticator = new MCPAuthenticator({
  secret: process.env.JWT_SECRET!,
});

const sessionManager = new SessionManager();
const verifier = new RequestVerifier();
const rateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});
const auditLogger = new AuditLogger();
const tokenVault = new TokenVault();

// Setup authorization rules
verifier.addRule({
  resource: 'projects',
  requiredScopes: ['read'],
});

// Handle authentication
async function authenticate(userId: string) {
  // Check rate limit
  const rateLimit = rateLimiter.checkLimit(userId);
  if (!rateLimit.allowed) {
    await auditLogger.logRateLimitExceeded(userId);
    throw new Error('Rate limit exceeded');
  }

  // Create session
  const session = sessionManager.createSession(userId);

  // Issue token
  const token = authenticator.issueToken(userId, session.sessionId, ['read', 'write']);

  // Store token securely
  await tokenVault.store(`${userId}-token`, token);

  // Log success
  await auditLogger.logAuthSuccess(userId, session.sessionId);

  return { token, session };
}

// Handle authorization
async function authorize(token: string, resource: string) {
  // Verify token
  const verification = authenticator.verifyToken(token);
  if (!verification.valid) {
    await auditLogger.logAuthFailure(verification.error || 'Unknown error');
    throw new Error('Invalid token');
  }

  // Verify session
  const sessionResult = sessionManager.verifySession(verification.payload!.sessionId);
  if (!sessionResult.valid) {
    throw new Error('Session expired');
  }

  // Check authorization
  const authResult = verifier.verify(resource, {
    userId: verification.payload!.userId,
    sessionId: verification.payload!.sessionId,
    scope: verification.payload!.scope,
  });

  await auditLogger.logAuthorizationCheck(
    verification.payload!.userId,
    verification.payload!.sessionId,
    resource,
    authResult.authorized ? 'success' : 'failure'
  );

  if (!authResult.authorized) {
    throw new Error(`Access denied: ${authResult.reason}`);
  }

  return verification.payload;
}
```

## Test Coverage

This package has **89%+ test coverage** with comprehensive unit tests for all components.

Run tests:

```bash
pnpm test
```

Run tests with coverage:

```bash
pnpm test:coverage
```

## License

Private - Part of workspace-hub project
