# Vikunja MCP Server - Security Configuration

This document describes the security configuration and implementation for the Vikunja MCP Gateway example.

## Overview

The Vikunja MCP server implements comprehensive security controls following Anthropic's MCP Security Best Practices and OWASP API Security guidelines.

## Security Features

### 1. Authentication (JWT)

**Implementation**: `examples/vikunja/src/index.ts:28-55`

- Algorithm: HMAC-SHA256
- Token Expiry: 1 hour (3600 seconds)
- Issuer: `vikunja-mcp-server`
- Required Environment Variable: `MCP_JWT_SECRET`

**Token Payload**:
```json
{
  "userId": "string",
  "sessionId": "uuid-v4",
  "scope": ["vikunja:read", "vikunja:write", "vikunja:delete"],
  "iat": 1234567890,
  "exp": 1234571490,
  "iss": "vikunja-mcp-server"
}
```

### 2. Session Management

**Implementation**: `packages/core/src/session/session-manager.ts`

- Session ID Format: UUID v4 (cryptographically random)
- Session Expiry: 24 hours (86400000 ms)
- Cleanup Interval: 60 seconds
- User Binding: Sessions stored with userId
- Auto-destruction: Expired sessions automatically removed

### 3. Scope-Based Authorization

**Implementation**: `examples/vikunja/src/tools.ts`

All tools require explicit scope authorization:

| Scope | Operations | Tools |
|-------|-----------|-------|
| `vikunja:read` | Read-only operations | list_projects, get_project, list_tasks, get_task, list_buckets, list_task_comments, get_next_task |
| `vikunja:write` | Create/update operations | create_project, update_project, create_task, update_task, create_bucket, update_bucket, add_task_comment, claim_task, complete_task_with_summary, add_task_checkpoint, release_task |
| `vikunja:write` + `vikunja:delete` | Destructive operations | delete_project, delete_task, delete_bucket |

**Authorization Flow**:
1. Verify JWT token signature and expiry
2. Verify session exists and not expired
3. Check required scopes present in token
4. Execute custom authorization check (if defined)
5. Allow or deny request

### 4. Rate Limiting

**Implementation**: `examples/vikunja/src/index.ts:34-37`

- Algorithm: Sliding window counter
- Window: 60 seconds (60000 ms)
- Max Requests: 60 per user per window
- Tracking: Per userId (not per session)
- Behavior: Returns 429 when limit exceeded

**Rate Limit Headers** (conceptual - not in stdio):
- `X-RateLimit-Limit: 60`
- `X-RateLimit-Remaining: 45`
- `X-RateLimit-Reset: 1234567890`

### 5. Audit Logging

**Implementation**: `examples/vikunja/src/index.ts:42-54`

**Logged Events**:
- ✅ Token issued/verified/expired/invalid
- ✅ Session created/destroyed/expired
- ✅ Authorization succeeded/failed
- ✅ Rate limit exceeded
- ✅ Tool execution success/error/failure

**Log Format**:
```
[AUDIT:INFO] 2024-01-16T12:00:00.000Z | tool_call | success | user=alice | session=uuid | resource=vikunja_list_tasks
[AUDIT:WARN] 2024-01-16T12:00:01.000Z | tool_call | failure | user=bob | session=uuid | resource=vikunja_delete_project | {"error":"Missing required scopes"}
```

**Log Storage**:
- In-memory buffer: 10,000 entries (circular)
- Output: stderr (configurable to file/external service)
- Retention: Application lifetime (in-memory)

### 6. Secure Token Storage

**Implementation**: `examples/vikunja/src/index.ts:38-41`

Third-party API tokens (Vikunja credentials) stored in OS keyring:

| Platform | Backend | Encryption |
|----------|---------|------------|
| macOS | Keychain | Hardware AES-256 |
| Linux | Secret Service | AES-256 (LUKS) |
| Windows | Credential Vault | DPAPI |

**Account Format**: `mcp-gateway:vikunja:<userId>`

**Security Policy**:
- ✅ No fallback to in-memory storage (`fallbackToMemory: false`)
- ✅ Tokens never in environment variables
- ✅ Tokens never in config files
- ✅ Tokens never in application logs

### 7. Input Validation

**Implementation**: `examples/vikunja/src/index.ts:96-122`

**Validation Checks**:
- ✅ Numeric IDs must be positive integers
- ✅ Pagination: `page >= 1`
- ✅ Pagination: `1 <= per_page <= 100`
- ✅ Schema validation with Zod on all tool inputs

### 8. Defense Against Attacks

**Implementation**: `examples/vikunja/src/index.ts:125-139`

**Mitigations**:
- ✅ Parameter pollution: Rejects `__proto__`, `constructor`, `prototype` in keys
- ✅ Injection attacks: Input validation on all parameters
- ✅ Token replay: Short token expiry (1 hour)
- ✅ Session hijacking: UUID v4 session IDs, user binding
- ✅ Privilege escalation: Scope-based authorization
- ✅ Credential theft: OS keyring encryption

## Security Checklist

### Configuration ✅

- [x] JWT secret is cryptographically random (>256 bits)
- [x] JWT secret stored securely (env var)
- [x] Session expiry configured (24 hours)
- [x] Token expiry configured (1 hour)
- [x] Rate limits configured (60 req/min)
- [x] Token vault configured (OS keyring, no fallback)

### Code ✅

- [x] All tools have authorization requirements
- [x] No sensitive data in error messages
- [x] No hardcoded credentials
- [x] Input validation on all parameters
- [x] No SQL injection vulnerabilities (N/A - using API client)
- [x] No command injection vulnerabilities

### Security Controls ✅

- [x] Authentication: JWT with HMAC-SHA256
- [x] Session Management: UUID v4, auto-expiry
- [x] Authorization: Scope-based + custom checks
- [x] Rate Limiting: 60 req/min per user
- [x] Audit Logging: All security events logged
- [x] Token Storage: OS keyring encryption

### Anthropic MCP Best Practices ✅

- [x] **No Token Passthrough**: MCP server issues own JWT tokens
- [x] **Token Validation**: All tokens verified (signature + expiry)
- [x] **Secure Session IDs**: UUID v4 with cryptographic randomness
- [x] **User Binding**: Sessions format `<userId>:<sessionId>`
- [x] **Request Verification**: All inbound requests verified
- [x] **Rate Limiting**: Per-user rate limits enforced
- [x] **Audit Logging**: All security events logged

## Configuration

### Environment Variables

```bash
# Required: JWT secret for token signing (minimum 256 bits / 32 bytes)
export MCP_JWT_SECRET=$(openssl rand -base64 32)

# Optional: Vikunja API URL (default: https://try.vikunja.io)
export VIKUNJA_API_URL=https://your-vikunja-instance.com
```

### Scope Assignment

When creating sessions, assign minimum required scopes:

```typescript
// Read-only access
const { token, sessionId } = server.createSession('userId', ['vikunja:read']);

// Read and write (most common)
const { token, sessionId } = server.createSession('userId', ['vikunja:read', 'vikunja:write']);

// Full access including delete
const { token, sessionId } = server.createSession('userId', ['vikunja:read', 'vikunja:write', 'vikunja:delete']);
```

### Custom Audit Logging

To send audit logs to external service:

```typescript
auditLoggerConfig: {
  maxEntries: 10000,
  onLog: async (entry) => {
    // Example: Send to external logging service
    await fetch('https://logs.example.com/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  },
}
```

## Security Monitoring

### Key Metrics

Monitor these metrics for security anomalies:

1. **Authentication Failures**: Spike indicates credential stuffing
2. **Rate Limit Violations**: Frequent violations indicate abuse
3. **Authorization Failures**: May indicate reconnaissance
4. **Session Creation Rate**: Unusual spike indicates automation

### Example Queries

```typescript
// Get failed authentications
const failures = server.getAuditLogger().getFailedEntries(100);

// Get rate limit violations for user
const violations = server.getAuditLogger().getUserEntries('alice')
  .filter(e => e.action === 'rate_limit_exceeded');

// Get authorization failures
const authFailures = server.getAuditLogger().getActionEntries('authorization_failed');
```

## Incident Response

If suspicious activity detected:

1. **Investigate**: Review audit logs for user/session
2. **Contain**: Destroy active sessions: `server.destroySession(sessionId)`
3. **Rotate**: Force credential rotation
4. **Review**: Analyze access patterns
5. **Remediate**: Fix vulnerabilities
6. **Document**: Record incident and response

## Production Deployment

### Pre-Deployment Checklist

- [ ] Generate cryptographically random JWT secret
- [ ] Store JWT secret in secure secret manager (not in code)
- [ ] Configure appropriate session expiry for use case
- [ ] Test OS keyring availability on target platform
- [ ] Configure audit log persistence (file/database/external service)
- [ ] Set up monitoring and alerting
- [ ] Document incident response procedures
- [ ] Test session expiration behavior
- [ ] Test rate limiting enforcement
- [ ] Review all tool authorization requirements

### Recommended Settings

```typescript
// Production configuration
{
  sessionExpiryMs: 24 * 60 * 60 * 1000,  // 24 hours
  tokenExpirySeconds: 3600,               // 1 hour
  rateLimitConfig: {
    windowMs: 60000,                      // 1 minute
    maxRequests: 60,                      // 60 req/min
  },
  tokenVaultConfig: {
    serviceName: 'mcp-vikunja',
    fallbackToMemory: false,              // Fail if keyring unavailable
  },
  auditLoggerConfig: {
    maxEntries: 10000,
    onLog: async (entry) => {
      // Write to persistent storage
      await writeToAuditLog(entry);
    },
  },
}
```

## References

- [Anthropic MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)
- [MCP Gateway Security Documentation](../../docs/SECURITY.md)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [JWT Best Practices (RFC 8725)](https://tools.ietf.org/html/rfc8725)
