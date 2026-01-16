#!/usr/bin/env node

/**
 * Integration demo showing all components working together
 */

import {
  MCPAuthenticator,
  SessionManager,
  RequestVerifier,
  RateLimiter,
  AuditLogger,
  TokenVault,
  SecurityEventType,
} from './dist/index.js';

console.log('🔐 MCP Security Integration Demo\n');

// Initialize all components
const authenticator = new MCPAuthenticator({
  secret: 'demo-secret-key-12345',
  tokenExpirySeconds: 3600,
  issuer: 'demo-server',
});

const sessionManager = new SessionManager({
  sessionExpiryMs: 3600000,
});

const verifier = new RequestVerifier();
verifier.addRule({
  resource: 'projects',
  requiredScopes: ['read'],
});
verifier.addRule({
  resource: 'admin',
  requiredScopes: ['admin'],
});

const rateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 10,
});

const auditLogger = new AuditLogger({
  maxEntries: 1000,
});

const tokenVault = new TokenVault({
  serviceName: 'demo-mcp-server',
  fallbackToMemory: true,
});

console.log('✅ All components initialized\n');

// Demo: Complete authentication flow
async function demonstrateAuthFlow() {
  console.log('📝 Demo: Complete Authentication Flow\n');

  const userId = 'demo-user-123';

  // 1. Check rate limit
  console.log('1. Checking rate limit...');
  const rateCheck = rateLimiter.checkLimit(userId);
  if (!rateCheck.allowed) {
    console.log('   ❌ Rate limit exceeded');
    await auditLogger.logRateLimitExceeded(userId);
    return;
  }
  console.log(`   ✅ Allowed (${rateCheck.remaining} remaining)\n`);

  // 2. Create session
  console.log('2. Creating user session...');
  const session = sessionManager.createSession(userId, {
    role: 'developer',
    ip: '127.0.0.1',
  });
  console.log(`   ✅ Session created: ${session.sessionId}\n`);

  // 3. Issue JWT token
  console.log('3. Issuing JWT token...');
  const token = authenticator.issueToken(userId, session.sessionId, ['read', 'write']);
  console.log(`   ✅ Token issued: ${token.substring(0, 50)}...\n`);

  // 4. Store token securely
  console.log('4. Storing token in vault...');
  await tokenVault.store(`${userId}-token`, token);
  console.log('   ✅ Token stored securely\n');

  // 5. Log successful authentication
  await auditLogger.logAuthSuccess(userId, session.sessionId, {
    timestamp: new Date(),
  });

  // 6. Verify token
  console.log('5. Verifying token...');
  const verification = authenticator.verifyToken(token);
  if (verification.valid) {
    console.log('   ✅ Token valid');
    console.log(`   User: ${verification.payload?.userId}`);
    console.log(`   Scopes: ${verification.payload?.scope.join(', ')}\n`);
  }

  // 7. Verify session
  console.log('6. Verifying session...');
  const sessionVerification = sessionManager.verifySession(session.sessionId);
  if (sessionVerification.valid) {
    console.log('   ✅ Session valid\n');
  }

  // 8. Check authorization for 'projects' resource
  console.log('7. Checking authorization for "projects"...');
  const authResult = verifier.verify('projects', {
    userId: verification.payload.userId,
    sessionId: verification.payload.sessionId,
    scope: verification.payload.scope,
  });

  if (authResult.authorized) {
    console.log('   ✅ Access granted to "projects"\n');
    await auditLogger.logAuthorizationCheck(
      userId,
      session.sessionId,
      'projects',
      'success'
    );
  }

  // 9. Check authorization for 'admin' resource (should fail)
  console.log('8. Checking authorization for "admin"...');
  const adminAuth = verifier.verify('admin', {
    userId: verification.payload.userId,
    sessionId: verification.payload.sessionId,
    scope: verification.payload.scope,
  });

  if (!adminAuth.authorized) {
    console.log(`   ❌ Access denied to "admin": ${adminAuth.reason}\n`);
    await auditLogger.logAuthorizationCheck(
      userId,
      session.sessionId,
      'admin',
      'failure'
    );
  }

  // 10. Retrieve token from vault
  console.log('9. Retrieving token from vault...');
  const storedToken = await tokenVault.retrieve(`${userId}-token`);
  console.log(`   ✅ Token retrieved: ${storedToken === token ? 'matches' : 'mismatch'}\n`);

  // 11. Show audit log
  console.log('10. Audit log summary:');
  const recentLogs = auditLogger.getRecentEntries(5);
  console.log(`   📊 ${recentLogs.length} recent entries:`);
  recentLogs.forEach((entry, i) => {
    console.log(`      ${i + 1}. ${entry.action} - ${entry.result}`);
  });

  // Cleanup
  await tokenVault.delete(`${userId}-token`);
  sessionManager.destroySession(session.sessionId);
  rateLimiter.destroy();

  console.log('\n✅ Demo completed successfully!\n');
}

// Run the demo
demonstrateAuthFlow().catch(console.error);
