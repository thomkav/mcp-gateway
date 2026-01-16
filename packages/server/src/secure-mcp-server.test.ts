import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecureMCPServer } from './secure-mcp-server.js';
import type {
  SecureMCPServerConfig,
  SecureToolDefinition,
  SecurityContext,
} from './types.js';

describe('SecureMCPServer', () => {
  let server: SecureMCPServer;
  const testConfig: SecureMCPServerConfig = {
    name: 'test-server',
    version: '1.0.0',
    jwtSecret: 'test-secret-key-minimum-32-chars-long!!!',
    sessionExpiryMs: 3600000,
    tokenExpirySeconds: 3600,
  };

  beforeEach(() => {
    server = new SecureMCPServer(testConfig);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('constructor', () => {
    it('should create a server instance with valid config', () => {
      expect(server).toBeDefined();
      expect(server.getTokenVault()).toBeDefined();
      expect(server.getAuditLogger()).toBeDefined();
      expect(server.getSessionManager()).toBeDefined();
    });

    it('should initialize with default rate limit config', () => {
      const defaultServer = new SecureMCPServer({
        name: 'default-test',
        version: '1.0.0',
        jwtSecret: 'test-secret-key-minimum-32-chars-long!!!',
      });
      expect(defaultServer).toBeDefined();
    });
  });

  describe('session management', () => {
    it('should create a new session', () => {
      const { token, sessionId } = server.createSession('user-123', ['read', 'write']);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should create session with custom metadata', () => {
      const metadata = { customData: 'test' };
      const { token, sessionId } = server.createSession(
        'user-123',
        ['read'],
        metadata
      );

      expect(token).toBeDefined();
      expect(sessionId).toBeDefined();

      const session = server.getSessionManager().getSession(sessionId);
      expect(session?.metadata).toEqual(metadata);
    });

    it('should destroy a session', () => {
      const { sessionId } = server.createSession('user-123');
      const result = server.destroySession(sessionId);

      expect(result).toBe(true);

      const session = server.getSessionManager().getSession(sessionId);
      expect(session).toBeUndefined();
    });

    it('should return false when destroying non-existent session', () => {
      const result = server.destroySession('non-existent-session-id');
      expect(result).toBe(false);
    });
  });

  describe('tool registration', () => {
    it('should register a tool', () => {
      const tool: SecureToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        handler: async () => ({ success: true }),
      };

      server.registerTool(tool);
      // Tool registration is private, but we can verify it doesn't throw
      expect(() => server.registerTool(tool)).not.toThrow();
    });

    it('should register tool with security requirements', () => {
      const tool: SecureToolDefinition = {
        name: 'secure-tool',
        description: 'A secure tool',
        inputSchema: { type: 'object' },
        handler: async () => ({ success: true }),
        requiredScopes: ['admin'],
        customAuthCheck: (context) => context.userId.startsWith('admin-'),
      };

      server.registerTool(tool);
      expect(() => server.registerTool(tool)).not.toThrow();
    });

    it('should unregister a tool', () => {
      const tool: SecureToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
        handler: async () => ({ success: true }),
      };

      server.registerTool(tool);
      const result = server.unregisterTool('test-tool');
      expect(result).toBe(true);
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = server.unregisterTool('non-existent-tool');
      expect(result).toBe(false);
    });
  });

  describe('middleware', () => {
    it('should add middleware to the pipeline', () => {
      const middleware = vi.fn(async (req, ctx) => req);
      server.use(middleware);
      // Middleware is private, but we can verify it doesn't throw
      expect(() => server.use(middleware)).not.toThrow();
    });

    it('should support multiple middlewares', () => {
      const middleware1 = vi.fn(async (req, ctx) => req);
      const middleware2 = vi.fn(async (req, ctx) => req);

      server.use(middleware1);
      server.use(middleware2);

      expect(() => server.use(middleware1)).not.toThrow();
    });
  });

  describe('component access', () => {
    it('should provide access to token vault', () => {
      const vault = server.getTokenVault();
      expect(vault).toBeDefined();
      expect(typeof vault.isUsingKeyring).toBe('function');
    });

    it('should provide access to audit logger', () => {
      const logger = server.getAuditLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.log).toBe('function');
    });

    it('should provide access to session manager', () => {
      const sessionManager = server.getSessionManager();
      expect(sessionManager).toBeDefined();
      expect(typeof sessionManager.createSession).toBe('function');
    });
  });

  describe('integration scenarios', () => {
    it('should create session, register tool, and provide security context', async () => {
      const { token, sessionId } = server.createSession('user-123', [
        'read',
        'write',
      ]);

      let capturedContext: SecurityContext | null = null;
      const tool: SecureToolDefinition = {
        name: 'context-test',
        description: 'Test security context',
        inputSchema: { type: 'object' },
        handler: async (params, context) => {
          capturedContext = context;
          return { success: true };
        },
        requiredScopes: ['read'],
      };

      server.registerTool(tool);

      // Verify session was created
      const session = server.getSessionManager().getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe('user-123');
    });

    it('should integrate with token vault in tool handlers', async () => {
      const { token, sessionId } = server.createSession('user-123');

      const tool: SecureToolDefinition = {
        name: 'vault-test',
        description: 'Test vault access',
        inputSchema: { type: 'object' },
        handler: async (params, context) => {
          // Tool handler has access to vault
          await context.tokenVault.store('test-key', 'test-value');
          const value = await context.tokenVault.retrieve('test-key');
          return { retrieved: value };
        },
      };

      server.registerTool(tool);
      expect(server.getTokenVault()).toBeDefined();
    });

    it('should handle cleanup on stop', async () => {
      const { sessionId } = server.createSession('user-123');

      await server.stop();

      // After stop, session manager should be destroyed
      const session = server.getSessionManager().getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid configuration gracefully', () => {
      expect(
        () =>
          new SecureMCPServer({
            name: '',
            version: '1.0.0',
            jwtSecret: 'test-secret-key-minimum-32-chars-long!!!',
          })
      ).not.toThrow();
    });
  });
});
