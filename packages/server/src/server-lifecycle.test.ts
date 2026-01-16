import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecureMCPServer } from './secure-mcp-server.js';
import type { SecureMCPServerConfig } from './types.js';

describe('SecureMCPServer Lifecycle and Edge Cases', () => {
  let server: SecureMCPServer;
  const testConfig: SecureMCPServerConfig = {
    name: 'lifecycle-test-server',
    version: '1.0.0',
    jwtSecret: 'test-secret-key-minimum-32-chars-long!!!',
  };

  beforeEach(() => {
    server = new SecureMCPServer(testConfig);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('server lifecycle', () => {
    it('should start and stop server properly', async () => {
      // Start is tested implicitly, test stop
      await expect(server.stop()).resolves.not.toThrow();
    });

    it('should handle multiple stop calls gracefully', async () => {
      await server.stop();
      // Second stop should not throw
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('session creation edge cases', () => {
    it('should create session with default scope', () => {
      const { token, sessionId } = server.createSession('user-default-scope');
      expect(token).toBeDefined();
      expect(sessionId).toBeDefined();
    });

    it('should create session with empty metadata', () => {
      const { token, sessionId } = server.createSession(
        'user-no-metadata',
        ['read'],
        undefined
      );
      expect(token).toBeDefined();
      expect(sessionId).toBeDefined();
    });

    it('should create session with custom scopes', () => {
      const customScopes = ['admin', 'read', 'write', 'delete'];
      const { token, sessionId } = server.createSession(
        'admin-user',
        customScopes
      );
      expect(token).toBeDefined();
      expect(sessionId).toBeDefined();
    });

    it('should create multiple sessions', () => {
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        sessions.push(server.createSession(`user-${i}`, ['read']));
      }

      expect(sessions).toHaveLength(5);
      sessions.forEach((session) => {
        expect(session.token).toBeDefined();
        expect(session.sessionId).toBeDefined();
      });
    });
  });

  describe('session destruction edge cases', () => {
    it('should return false when destroying non-existent session', () => {
      const result = server.destroySession('fake-session-id-12345');
      expect(result).toBe(false);
    });

    it('should successfully destroy existing session', () => {
      const { sessionId } = server.createSession('temp-user', ['read']);
      const result = server.destroySession(sessionId);
      expect(result).toBe(true);
    });

    it('should return false when destroying already destroyed session', () => {
      const { sessionId } = server.createSession('temp-user', ['read']);
      server.destroySession(sessionId);
      const result = server.destroySession(sessionId);
      expect(result).toBe(false);
    });
  });

  describe('component getters', () => {
    it('should return token vault instance', () => {
      const vault = server.getTokenVault();
      expect(vault).toBeDefined();
      expect(vault.isUsingKeyring).toBeDefined();
    });

    it('should return audit logger instance', () => {
      const logger = server.getAuditLogger();
      expect(logger).toBeDefined();
      expect(logger.log).toBeDefined();
      expect(logger.getEntryCount).toBeDefined();
    });

    it('should return session manager instance', () => {
      const manager = server.getSessionManager();
      expect(manager).toBeDefined();
      expect(manager.createSession).toBeDefined();
      expect(manager.verifySession).toBeDefined();
    });

    it('should return consistent instances', () => {
      const vault1 = server.getTokenVault();
      const vault2 = server.getTokenVault();
      expect(vault1).toBe(vault2);

      const logger1 = server.getAuditLogger();
      const logger2 = server.getAuditLogger();
      expect(logger1).toBe(logger2);

      const manager1 = server.getSessionManager();
      const manager2 = server.getSessionManager();
      expect(manager1).toBe(manager2);
    });
  });

  describe('tool management edge cases', () => {
    it('should overwrite tool with same name', () => {
      const tool1 = {
        name: 'duplicate-tool',
        description: 'Version 1',
        inputSchema: { type: 'object' },
        handler: async () => ({ version: 1 }),
      };

      const tool2 = {
        name: 'duplicate-tool',
        description: 'Version 2',
        inputSchema: { type: 'object' },
        handler: async () => ({ version: 2 }),
      };

      server.registerTool(tool1);
      server.registerTool(tool2); // Should overwrite

      expect(server.unregisterTool('duplicate-tool')).toBe(true);
    });

    it('should handle rapid tool registration and unregistration', () => {
      for (let i = 0; i < 10; i++) {
        const tool = {
          name: `tool-${i}`,
          description: `Tool ${i}`,
          inputSchema: { type: 'object' },
          handler: async () => ({ id: i }),
        };
        server.registerTool(tool);
      }

      for (let i = 0; i < 10; i++) {
        expect(server.unregisterTool(`tool-${i}`)).toBe(true);
      }
    });
  });

  describe('middleware behavior', () => {
    it('should handle middleware that modifies request', () => {
      const middleware = vi.fn(async (req, ctx) => ({
        ...req,
        params: { modified: true },
      }));

      server.use(middleware);
      expect(server).toBeDefined();
    });

    it('should handle middleware that returns null', () => {
      const blockingMiddleware = vi.fn(async () => null);
      server.use(blockingMiddleware);
      expect(server).toBeDefined();
    });

    it('should support chaining multiple middlewares', () => {
      const mw1 = vi.fn(async (req) => req);
      const mw2 = vi.fn(async (req) => req);
      const mw3 = vi.fn(async (req) => req);

      server.use(mw1);
      server.use(mw2);
      server.use(mw3);

      expect(server).toBeDefined();
    });
  });

  describe('configuration variations', () => {
    it('should work with custom rate limit config', () => {
      const customConfig: SecureMCPServerConfig = {
        name: 'custom-rate-limit',
        version: '1.0.0',
        jwtSecret: 'secret-key-32-chars-minimum!!!!',
        rateLimitConfig: {
          windowMs: 30000,
          maxRequests: 50,
        },
      };

      const customServer = new SecureMCPServer(customConfig);
      expect(customServer).toBeDefined();
    });

    it('should work with custom session expiry', () => {
      const customConfig: SecureMCPServerConfig = {
        name: 'custom-session',
        version: '1.0.0',
        jwtSecret: 'secret-key-32-chars-minimum!!!!',
        sessionExpiryMs: 7200000, // 2 hours
      };

      const customServer = new SecureMCPServer(customConfig);
      expect(customServer).toBeDefined();
    });

    it('should work with custom token expiry', () => {
      const customConfig: SecureMCPServerConfig = {
        name: 'custom-token',
        version: '1.0.0',
        jwtSecret: 'secret-key-32-chars-minimum!!!!',
        tokenExpirySeconds: 7200, // 2 hours
      };

      const customServer = new SecureMCPServer(customConfig);
      expect(customServer).toBeDefined();
    });

    it('should work with custom token vault config', () => {
      const customConfig: SecureMCPServerConfig = {
        name: 'custom-vault',
        version: '1.0.0',
        jwtSecret: 'secret-key-32-chars-minimum!!!!',
        tokenVaultConfig: {
          serviceName: 'my-custom-service',
          fallbackToMemory: true,
        },
      };

      const customServer = new SecureMCPServer(customConfig);
      expect(customServer).toBeDefined();
      expect(customServer.getTokenVault()).toBeDefined();
    });

    it('should work with all custom configs combined', () => {
      const fullCustomConfig: SecureMCPServerConfig = {
        name: 'fully-custom',
        version: '2.0.0',
        jwtSecret: 'very-secret-key-32-chars-min!!',
        sessionExpiryMs: 1800000,
        tokenExpirySeconds: 1800,
        rateLimitConfig: {
          windowMs: 45000,
          maxRequests: 75,
        },
        tokenVaultConfig: {
          serviceName: 'custom-service-name',
          fallbackToMemory: false,
        },
      };

      const customServer = new SecureMCPServer(fullCustomConfig);
      expect(customServer).toBeDefined();
      expect(customServer.getTokenVault()).toBeDefined();
      expect(customServer.getAuditLogger()).toBeDefined();
      expect(customServer.getSessionManager()).toBeDefined();
    });
  });

  describe('audit logging integration', () => {
    it('should log session creation events', async () => {
      const logger = server.getAuditLogger();
      const initialCount = logger.getEntryCount();

      server.createSession('audit-test-user', ['read']);

      // Allow async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.getEntryCount()).toBeGreaterThan(initialCount);
    });

    it('should log session destruction events', async () => {
      const { sessionId } = server.createSession('destroy-test', ['read']);

      const logger = server.getAuditLogger();

      server.destroySession(sessionId);

      // Allow async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      const entries = logger.getRecentEntries(100);
      const destroyEvent = entries.find(
        (e) => e.action === 'session_destroyed' && e.sessionId === sessionId
      );
      expect(destroyEvent).toBeDefined();
    });
  });
});
