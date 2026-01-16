#!/usr/bin/env node

/**
 * Test script to verify subpath exports work correctly
 */

import { MCPAuthenticator } from './dist/authenticator/index.js';
import { SessionManager } from './dist/session/index.js';
import { RequestVerifier, RateLimiter, AuditLogger } from './dist/verification/index.js';
import { TokenVault } from './dist/storage/index.js';

console.log('Testing @workspace-hub/mcp-security subpath exports...\n');

console.log('✓ authenticator subpath:', typeof MCPAuthenticator === 'function');
console.log('✓ session subpath:', typeof SessionManager === 'function');
console.log('✓ verification subpath (RequestVerifier):', typeof RequestVerifier === 'function');
console.log('✓ verification subpath (RateLimiter):', typeof RateLimiter === 'function');
console.log('✓ verification subpath (AuditLogger):', typeof AuditLogger === 'function');
console.log('✓ storage subpath:', typeof TokenVault === 'function');

console.log('\n✓ All subpath exports verified successfully!');
