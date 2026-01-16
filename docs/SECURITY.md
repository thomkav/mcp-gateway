# Security Architecture

Comprehensive security documentation for MCP Gateway.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Threat Model](#threat-model)
- [Security Components](#security-components)
- [Compliance](#compliance)
- [Best Practices](#best-practices)
- [Audit & Monitoring](#audit--monitoring)

## Overview

MCP Gateway provides a production-ready security framework for Model Context Protocol (MCP) servers. It implements Anthropic's [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) with defense-in-depth security controls.

### Security Objectives

1. **No Token Passthrough** - MCP server issues its own tokens, never passes through third-party tokens
2. **Strong Authentication** - JWT-based authentication with cryptographic signatures
3. **Session Isolation** - User-bound sessions with automatic expiration
4. **Request Verification** - All inbound requests verified for authenticity
5. **Authorization** - Scope-based and custom authorization checks
6. **Rate Limiting** - Per-user rate limits to prevent abuse
7. **Audit Logging** - Comprehensive security event logging
8. **Secure Storage** - Tokens encrypted at rest in OS keyring

## Architecture

### System Architecture

```
┌─────────────────┐
│  Claude Code    │
│  (MCP Client)   │
└────────┬────────┘
         │ stdio/HTTP
         ↓
┌─────────────────────────────────────────┐
│          MCP Gateway Server              │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │  Request Handler (MCP Protocol)  │  │
│  └──────────┬───────────────────────┘  │
│             ↓                           │
│  ┌──────────────────────────────────┐  │
│  │      Authentication Layer        │  │
│  │  - JWT Token Verification        │  │
│  │  - Signature Validation          │  │
│  └──────────┬───────────────────────┘  │
│             ↓                           │
│  ┌──────────────────────────────────┐  │
│  │       Session Management         │  │
│  │  - Session Validation            │  │
│  │  - Expiry Checks                 │  │
│  └──────────┬───────────────────────┘  │
│             ↓                           │
│  ┌──────────────────────────────────┐  │
│  │      Authorization Layer         │  │
│  │  - Scope Checks                  │  │
│  │  - Custom Rules                  │  │
│  └──────────┬───────────────────────┘  │
│             ↓                           │
│  ┌──────────────────────────────────┐  │
│  │       Rate Limiting              │  │
│  │  - Per-User Limits               │  │
│  │  - Window-Based Tracking         │  │
│  └──────────┬───────────────────────┘  │
│             ↓                           │
│  ┌──────────────────────────────────┐  │
│  │        Audit Logger              │  │
│  │  - Security Event Logging        │  │
│  └──────────┬───────────────────────┘  │
│             ↓                           │
│  ┌──────────────────────────────────┐  │
│  │      Tool Execution              │  │
│  └──────────┬───────────────────────┘  │
└─────────────┼───────────────────────────┘
              ↓
    ┌─────────────────┐
    │   Token Vault   │
    │  (OS Keyring)   │
    └────────┬────────┘
             ↓
    ┌─────────────────┐
    │  External APIs  │
    │ (Vikunja, etc.) │
    └─────────────────┘
```

### Data Flow

1. **Request Reception**: MCP client sends request with JWT token
2. **Token Verification**: JWT signature and claims validated
3. **Session Check**: Session existence and expiry verified
4. **Authorization**: Scopes and custom rules checked
5. **Rate Limit**: User's request count validated
6. **Audit Log**: Security event logged
7. **Tool Execution**: Business logic executed with security context
8. **Response**: Result returned to client

## Threat Model

### Threat Actors

1. **Malicious Users** - Authenticated users attempting to exceed privileges
2. **Token Thieves** - Attackers with stolen JWT tokens
3. **Replay Attackers** - Attackers replaying captured requests
4. **Rate Limit Evaders** - Users attempting to bypass rate limits
5. **Privilege Escalators** - Users attempting to access unauthorized resources

### Attack Scenarios

#### 1. Token Passthrough Attack

**Threat**: Attacker passes third-party API token directly to MCP server

**Mitigation**:
- ✅ MCP Gateway issues its own JWT tokens
- ✅ Third-party tokens stored securely in Token Vault
- ✅ Token Vault access only via authenticated sessions
- ✅ No direct token passthrough allowed

#### 2. Session Hijacking

**Threat**: Attacker steals session token and impersonates user

**Mitigation**:
- ✅ Sessions bound to user ID (`<userId>:<sessionId>`)
- ✅ UUID-based session IDs with cryptographic randomness
- ✅ Automatic session expiration
- ✅ Session destruction on logout
- ✅ Audit logs track all session activity

#### 3. Token Replay Attack

**Threat**: Attacker replays captured JWT token

**Mitigation**:
- ✅ Short token expiry (default: 15 minutes)
- ✅ Session validation on every request
- ✅ Session can be destroyed to invalidate all tokens
- ⚠️ Consider adding nonce for critical operations

#### 4. Privilege Escalation

**Threat**: User attempts to access resources beyond their scope

**Mitigation**:
- ✅ Scope-based authorization (e.g., `vikunja:read`, `vikunja:write`)
- ✅ Custom authorization checks per tool
- ✅ Authorization failures logged
- ✅ Principle of least privilege enforced

#### 5. Rate Limit Bypass

**Threat**: Attacker creates multiple sessions to bypass rate limits

**Mitigation**:
- ✅ Rate limits enforced per user ID (not per session)
- ✅ Multiple sessions share same rate limit quota
- ✅ Rate limit exceeded events logged
- ⚠️ Consider IP-based rate limiting for additional protection

#### 6. Credential Theft from Storage

**Threat**: Attacker gains access to stored API tokens

**Mitigation**:
- ✅ Tokens stored in OS-level keyring (encrypted at rest)
- ✅ macOS: Keychain with hardware encryption
- ✅ Linux: Secret Service with encrypted vault
- ✅ Windows: Credential Vault with DPAPI
- ✅ No tokens in environment variables or config files

#### 7. Authorization Bypass

**Threat**: Attacker crafts requests to bypass authorization

**Mitigation**:
- ✅ All requests pass through RequestVerifier
- ✅ Fail-secure: denied by default, explicit allow required
- ✅ Both scope and custom checks must pass
- ✅ Authorization logic in server (not client)

## Security Components

### 1. MCPAuthenticator

**Purpose**: JWT token issuance and verification

**Implementation**:
```typescript
class MCPAuthenticator {
  // Issues JWT with user, session, scope claims
  issueToken(userId: string, sessionId: string, scope: string[]): string;

  // Verifies JWT signature and expiry
  verifyToken(token: string): TokenVerificationResult;
}
```

**Security Properties**:
- HMAC-SHA256 signature algorithm
- Configurable expiry (default: 15 minutes)
- Issuer validation
- Claims validation (iat, exp, iss)

**Configuration**:
```typescript
{
  secret: string;              // HMAC secret (>256 bits)
  tokenExpirySeconds: number;  // Token TTL
  issuer: string;             // Expected issuer claim
}
```

### 2. SessionManager

**Purpose**: User session lifecycle management

**Implementation**:
```typescript
class SessionManager {
  // Create new session with UUID
  createSession(userId: string, metadata?: object): SessionData;

  // Verify session exists and not expired
  verifySession(sessionId: string): SessionVerificationResult;

  // Destroy session (logout)
  destroySession(sessionId: string): boolean;
}
```

**Security Properties**:
- UUID v4 session IDs (cryptographically random)
- User binding: `sessionId` stored with `userId`
- Automatic expiration (default: 1 hour)
- Background cleanup of expired sessions
- In-memory storage (no persistence)

**Session Format**:
```typescript
{
  sessionId: string;      // UUID v4
  userId: string;         // User identifier
  createdAt: Date;        // Creation timestamp
  expiresAt: Date;        // Expiration timestamp
  metadata?: object;      // Optional metadata
}
```

### 3. RequestVerifier

**Purpose**: Authorization rule enforcement

**Implementation**:
```typescript
class RequestVerifier {
  // Add authorization rule
  addRule(rule: AuthorizationRule): void;

  // Verify request against rules
  verify(resource: string, context: AuthContext): AuthorizationResult;
}
```

**Authorization Rules**:
```typescript
{
  resource: string;                           // Resource identifier
  requiredScopes: string[];                   // Required scope list
  customCheck?: (context: AuthContext) => boolean;  // Custom logic
}
```

**Verification Logic**:
1. Find rule for resource
2. Check all required scopes present in user's scope
3. If custom check exists, execute it
4. Both must pass for authorization

### 4. RateLimiter

**Purpose**: Prevent abuse through request throttling

**Implementation**:
```typescript
class RateLimiter {
  // Check if user is within rate limit
  checkLimit(userId: string): RateLimitResult;
}
```

**Algorithm**: Sliding window counter
- Window size: configurable (default: 60 seconds)
- Max requests per window: configurable (default: 100)
- Per-user tracking (not per-session)
- Automatic window cleanup

**Configuration**:
```typescript
{
  windowMs: number;      // Window size in milliseconds
  maxRequests: number;   // Max requests per window
}
```

### 5. AuditLogger

**Purpose**: Security event logging for monitoring and forensics

**Implementation**:
```typescript
class AuditLogger {
  // Log security event
  log(
    action: string,
    result: 'success' | 'failure' | 'error',
    details?: object
  ): Promise<void>;

  // Query logs
  getLogs(filters?: object): AuditLogEntry[];
}
```

**Logged Events**:
- Token issued/verified/expired/invalid
- Session created/verified/expired/destroyed
- Authorization succeeded/failed
- Rate limit exceeded
- Tool execution success/failure/error

**Log Entry Format**:
```typescript
{
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  result: 'success' | 'failure' | 'error';
  metadata?: object;
}
```

### 6. TokenVault

**Purpose**: Secure storage for third-party API tokens

**Implementation**:
```typescript
class TokenVault {
  // Store token for user and service
  setToken(userId: string, service: string, token: string): Promise<void>;

  // Retrieve token
  getToken(userId: string, service: string): Promise<string | null>;

  // Delete token
  deleteToken(userId: string, service: string): Promise<boolean>;
}
```

**Storage Backends**:

| Platform | Backend | Encryption |
|----------|---------|------------|
| macOS | Keychain | Hardware AES-256 |
| Linux | Secret Service | AES-256 (LUKS) |
| Windows | Credential Vault | DPAPI |
| Fallback | In-Memory | None (dev only) |

**Account Format**: `mcp-gateway:<service>:<userId>`

## Compliance

### Anthropic MCP Security Best Practices

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **No Token Passthrough** | ✅ Complete | MCP server issues own JWT tokens; third-party tokens in TokenVault |
| **Token Validation** | ✅ Complete | All tokens verified to be issued by MCP server (signature check) |
| **Secure Session IDs** | ✅ Complete | UUID v4 with cryptographic randomness |
| **User Binding** | ✅ Complete | Sessions format `<userId>:<sessionId>` |
| **Request Verification** | ✅ Complete | All inbound requests verified via RequestVerifier |
| **Rate Limiting** | ✅ Complete | Per-user rate limits with RateLimiter |
| **Audit Logging** | ✅ Complete | All security events logged via AuditLogger |

### OWASP Top 10 (API Security)

| Risk | Mitigation |
|------|------------|
| **A01: Broken Object Level Authorization** | ✅ Scope-based + custom authorization per resource |
| **A02: Broken Authentication** | ✅ JWT with HMAC-SHA256, session validation |
| **A03: Broken Object Property Level Authorization** | ✅ Tool-level authorization, no unauthorized data access |
| **A04: Unrestricted Resource Access** | ✅ Rate limiting per user |
| **A05: Broken Function Level Authorization** | ✅ RequiredScopes + customAuthCheck per tool |
| **A06: Unrestricted Access to Sensitive Business Flows** | ✅ Rate limiting + audit logging |
| **A07: Server Side Request Forgery** | ⚠️ Tool implementation responsibility |
| **A08: Security Misconfiguration** | ✅ Secure defaults, explicit config required |
| **A09: Improper Inventory Management** | ✅ Audit logs track all resources |
| **A10: Unsafe Consumption of APIs** | ✅ TokenVault isolates credentials |

## Best Practices

### Deployment

1. **JWT Secret Management**
   - Use cryptographically random secret (>256 bits)
   - Store in environment variable or secret manager
   - Rotate regularly (every 90 days)
   - Never commit to version control

2. **Session Configuration**
   - Production: 24-hour session expiry
   - High-security: 1-hour session expiry
   - Destroy sessions on logout
   - Monitor active session count

3. **Token Expiry**
   - Short-lived tokens (15-60 minutes)
   - Force re-authentication on token expiry
   - Consider refresh tokens for long sessions

4. **Rate Limiting**
   - Start conservative (60 req/min)
   - Monitor usage patterns
   - Adjust based on legitimate traffic
   - Log rate limit violations

5. **Token Vault**
   - Never use in-memory vault in production
   - Ensure OS keyring is available
   - Test keyring access before deployment
   - Monitor vault access in audit logs

### Development

1. **Testing**
   - Test with expired tokens
   - Test with invalid signatures
   - Test rate limit enforcement
   - Test session expiration

2. **Error Handling**
   - Don't leak sensitive info in errors
   - Log errors to audit logger
   - Return generic "unauthorized" messages

3. **Scopes**
   - Follow principle of least privilege
   - Use granular scopes (e.g., `service:resource:action`)
   - Document scope requirements
   - Validate scopes on every request

4. **Custom Authorization**
   - Keep logic simple and testable
   - Fail secure (deny by default)
   - Log authorization decisions
   - Don't duplicate scope checks

## Audit & Monitoring

### Key Metrics

Monitor these metrics for security anomalies:

1. **Authentication Failures**
   - Spike indicates credential stuffing
   - Track by user ID and IP

2. **Rate Limit Violations**
   - Frequent violations indicate abuse
   - May indicate compromised credentials

3. **Authorization Failures**
   - Track which resources are targeted
   - Pattern may indicate reconnaissance

4. **Session Creation Rate**
   - Unusual spike indicates automation
   - May indicate account compromise

5. **Token Expiration Events**
   - High rate indicates configuration issue
   - Or users not rotating properly

### Log Analysis

Query audit logs for security events:

```typescript
// Get failed authentications
const failures = auditLogger.getLogs({
  result: 'failure',
  action: /token_verified/,
});

// Get rate limit violations
const violations = auditLogger.getLogs({
  action: 'rate_limit_exceeded',
});

// Get authorization failures by user
const authFailures = auditLogger.getLogs({
  userId: 'user-123',
  result: 'failure',
  action: /authorization/,
});
```

### Alerting

Set up alerts for:

- 5+ authentication failures in 1 minute (same user)
- 10+ rate limit violations in 5 minutes (same user)
- Any authorization failure for admin tools
- Token vault access failures
- Session creation rate >100/minute

### Incident Response

If suspicious activity detected:

1. **Investigate** - Review audit logs for user/session
2. **Contain** - Destroy active sessions for affected user
3. **Rotate** - Force credential rotation
4. **Review** - Analyze access patterns
5. **Remediate** - Fix vulnerabilities
6. **Document** - Record incident and response

## Security Checklist

Use this checklist before production deployment:

### Configuration
- [ ] JWT secret is cryptographically random (>256 bits)
- [ ] JWT secret stored securely (env var or secret manager)
- [ ] Session expiry configured appropriately
- [ ] Token expiry configured appropriately
- [ ] Rate limits configured for expected load
- [ ] Token vault configured (not in-memory)

### Code
- [ ] All tools have authorization requirements
- [ ] No sensitive data in error messages
- [ ] No hardcoded credentials
- [ ] Input validation on all parameters
- [ ] No SQL injection vulnerabilities
- [ ] No command injection vulnerabilities

### Infrastructure
- [ ] OS keyring available and tested
- [ ] Audit logs written to persistent storage
- [ ] Logs rotated and retained per policy
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented

### Testing
- [ ] Authentication bypass attempts blocked
- [ ] Authorization bypass attempts blocked
- [ ] Rate limiting enforced
- [ ] Session expiration works
- [ ] Token expiration works
- [ ] Audit logs capture all events

### Documentation
- [ ] Security architecture documented
- [ ] Threat model documented
- [ ] Incident response plan documented
- [ ] Runbooks for common scenarios
- [ ] User training completed

## References

- [Anthropic MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)
