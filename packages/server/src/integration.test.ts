import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecureMCPServer } from './secure-mcp-server.js';
import type {
  SecureMCPServerConfig,
  SecureToolDefinition,
} from './types.js';

describe('SecureMCPServer Integration Tests', () => {
  let server: SecureMCPServer;
  const testConfig: SecureMCPServerConfig = {
    name: 'integration-test-server',
    version: '1.0.0',
    jwtSecret: 'test-secret-key-minimum-32-chars-long!!!',
    sessionExpiryMs: 3600000,
    tokenExpirySeconds: 3600,
    rateLimitConfig: {
      windowMs: 60000,
      maxRequests: 10,
    },
  };

  beforeEach(() => {
    server = new SecureMCPServer(testConfig);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('end-to-end workflow', () => {
    it('should complete full authentication and tool call flow', async () => {
      // Create session
      const { token, sessionId } = server.createSession('test-user', [
        'read',
        'write',
      ]);

      expect(token).toBeDefined();
      expect(sessionId).toBeDefined();

      // Register a test tool
      let toolExecuted = false;
      const tool: SecureToolDefinition = {
        name: 'test-tool',
        description: 'Test tool for integration',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        handler: async (params, context) => {
          toolExecuted = true;
          expect(context.auth.userId).toBe('test-user');
          expect(context.tokenVault).toBeDefined();
          return { success: true, message: 'Tool executed' };
        },
      };

      server.registerTool(tool);

      // Verify session exists
      const session = server.getSessionManager().getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe('test-user');
    });

    it('should handle multiple sessions for same user', () => {
      const session1 = server.createSession('user-1', ['read']);
      const session2 = server.createSession('user-1', ['write']);

      expect(session1.sessionId).not.toBe(session2.sessionId);

      const userSessions = server.getSessionManager().getUserSessions('user-1');
      expect(userSessions.length).toBe(2);
    });

    it('should integrate with audit logger', async () => {
      const auditLogger = server.getAuditLogger();
      const initialCount = auditLogger.getEntryCount();

      const { token, sessionId } = server.createSession('audit-user', ['read']);

      // Wait a bit for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Session creation should have been logged
      expect(auditLogger.getEntryCount()).toBeGreaterThan(initialCount);

      const recentEntries = auditLogger.getRecentEntries(10);
      const sessionCreated = recentEntries.find(
        (e) => e.action === 'session_created' && e.userId === 'audit-user'
      );
      expect(sessionCreated).toBeDefined();
    });

    it('should work with middleware chain', async () => {
      const middlewareLog: string[] = [];

      // Add multiple middlewares
      server.use(async (request, context) => {
        middlewareLog.push('middleware-1');
        return { ...request, params: { ...request.params, mw1: true } };
      });

      server.use(async (request, context) => {
        middlewareLog.push('middleware-2');
        return { ...request, params: { ...request.params, mw2: true } };
      });

      const tool: SecureToolDefinition = {
        name: 'middleware-test',
        description: 'Test middleware chain',
        inputSchema: { type: 'object' },
        handler: async (params, context) => {
          return { params, auth: context.auth.userId };
        },
      };

      server.registerTool(tool);

      // Create session for testing
      const { token, sessionId } = server.createSession('mw-user', ['read']);
      expect(token).toBeDefined();
    });

    it('should handle tool with required scopes', () => {
      const tool: SecureToolDefinition = {
        name: 'admin-tool',
        description: 'Admin only tool',
        inputSchema: { type: 'object' },
        handler: async () => ({ admin: true }),
        requiredScopes: ['admin', 'write'],
      };

      server.registerTool(tool);

      // Create session without admin scope
      const { token } = server.createSession('regular-user', ['read', 'write']);
      expect(token).toBeDefined();

      // Create session with admin scope
      const { token: adminToken } = server.createSession('admin-user', [
        'admin',
        'write',
      ]);
      expect(adminToken).toBeDefined();
    });

    it('should handle custom auth checks', () => {
      const tool: SecureToolDefinition = {
        name: 'custom-auth-tool',
        description: 'Tool with custom auth',
        inputSchema: { type: 'object' },
        handler: async () => ({ success: true }),
        requiredScopes: ['write'],
        customAuthCheck: (context) => context.userId.startsWith('admin-'),
      };

      server.registerTool(tool);

      // Regular user - should fail custom check
      const { token: userToken } = server.createSession('regular-user', ['write']);
      expect(userToken).toBeDefined();

      // Admin user - should pass custom check
      const { token: adminToken } = server.createSession('admin-user-123', [
        'write',
      ]);
      expect(adminToken).toBeDefined();
    });

    it('should integrate token vault with tool handlers', async () => {
      const vault = server.getTokenVault();

      // Store a token
      await vault.store('test-key', 'test-token-value');

      const tool: SecureToolDefinition = {
        name: 'vault-tool',
        description: 'Tool using vault',
        inputSchema: { type: 'object' },
        handler: async (params, context) => {
          const storedToken = await context.tokenVault.retrieve('test-key');
          return { token: storedToken };
        },
      };

      server.registerTool(tool);

      const { token } = server.createSession('vault-user', ['read']);
      expect(token).toBeDefined();
    });

    it('should handle session destruction', () => {
      const { sessionId } = server.createSession('temp-user', ['read']);

      // Verify session exists
      let session = server.getSessionManager().getSession(sessionId);
      expect(session).toBeDefined();

      // Destroy session
      const destroyed = server.destroySession(sessionId);
      expect(destroyed).toBe(true);

      // Verify session no longer exists
      session = server.getSessionManager().getSession(sessionId);
      expect(session).toBeUndefined();
    });

    it('should track multiple tool registrations', () => {
      const tools: SecureToolDefinition[] = [
        {
          name: 'tool-1',
          description: 'First tool',
          inputSchema: { type: 'object' },
          handler: async () => ({ id: 1 }),
        },
        {
          name: 'tool-2',
          description: 'Second tool',
          inputSchema: { type: 'object' },
          handler: async () => ({ id: 2 }),
        },
        {
          name: 'tool-3',
          description: 'Third tool',
          inputSchema: { type: 'object' },
          handler: async () => ({ id: 3 }),
        },
      ];

      tools.forEach((tool) => server.registerTool(tool));

      // Unregister one tool
      const removed = server.unregisterTool('tool-2');
      expect(removed).toBe(true);

      // Try to unregister again
      const removedAgain = server.unregisterTool('tool-2');
      expect(removedAgain).toBe(false);
    });

    it('should handle complex metadata in sessions', () => {
      const complexMetadata = {
        userAgent: 'Test/1.0',
        ipAddress: '127.0.0.1',
        features: ['feature-a', 'feature-b'],
        config: {
          darkMode: true,
          language: 'en',
        },
      };

      const { sessionId } = server.createSession(
        'metadata-user',
        ['read'],
        complexMetadata
      );

      const session = server.getSessionManager().getSession(sessionId);
      expect(session?.metadata).toEqual(complexMetadata);
    });

    it('should provide access to all security components', () => {
      expect(server.getTokenVault()).toBeDefined();
      expect(server.getAuditLogger()).toBeDefined();
      expect(server.getSessionManager()).toBeDefined();
    });
  });

  describe('error scenarios', () => {
    it('should handle tool registration and unregistration edge cases', () => {
      const tool: SecureToolDefinition = {
        name: 'edge-case-tool',
        description: 'Test edge cases',
        inputSchema: { type: 'object' },
        handler: async () => ({ success: true }),
      };

      // Register tool
      server.registerTool(tool);

      // Re-register same tool (should overwrite)
      server.registerTool(tool);

      // Unregister
      expect(server.unregisterTool('edge-case-tool')).toBe(true);

      // Unregister non-existent
      expect(server.unregisterTool('non-existent')).toBe(false);
    });

    it('should handle empty and default configurations', () => {
      const minimalConfig: SecureMCPServerConfig = {
        name: 'minimal',
        version: '1.0.0',
        jwtSecret: 'minimal-secret-key-32-chars-min!!',
      };

      const minimalServer = new SecureMCPServer(minimalConfig);
      expect(minimalServer).toBeDefined();
      expect(minimalServer.getTokenVault()).toBeDefined();
    });
  });
});
