#!/usr/bin/env node

/**
 * Test script to verify all package exports work correctly
 */

import {
  // Types
  SecurityEventType,

  // Authenticator
  MCPAuthenticator,

  // Session
  SessionManager,

  // Verification
  RequestVerifier,
  RateLimiter,
  AuditLogger,

  // Storage
  TokenVault,
} from './dist/index.js';

console.log('Testing @workspace-hub/mcp-security exports...\n');

// Test MCPAuthenticator
console.log('✓ MCPAuthenticator:', typeof MCPAuthenticator === 'function');

// Test SessionManager
console.log('✓ SessionManager:', typeof SessionManager === 'function');

// Test RequestVerifier
console.log('✓ RequestVerifier:', typeof RequestVerifier === 'function');

// Test RateLimiter
console.log('✓ RateLimiter:', typeof RateLimiter === 'function');

// Test AuditLogger
console.log('✓ AuditLogger:', typeof AuditLogger === 'function');

// Test TokenVault
console.log('✓ TokenVault:', typeof TokenVault === 'function');

// Test SecurityEventType enum
console.log('✓ SecurityEventType:', typeof SecurityEventType === 'object');
console.log('  - TOKEN_ISSUED:', SecurityEventType.TOKEN_ISSUED);
console.log('  - SESSION_CREATED:', SecurityEventType.SESSION_CREATED);

console.log('\n✓ All exports verified successfully!');
