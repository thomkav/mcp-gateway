import { describe, it, expect } from 'vitest';
import type {
  SecurityContext,
  MCPRequest,
  MCPResponse,
  ToolHandler,
  SecureToolDefinition,
  SecureMCPServerConfig,
  MiddlewareFunction,
} from './types.js';

describe('Type definitions', () => {
  describe('SecurityContext', () => {
    it('should have auth and tokenVault properties', () => {
      const context: Partial<SecurityContext> = {
        auth: {
          userId: 'user-123',
          sessionId: 'session-456',
          scope: ['read', 'write'],
        },
      };

      expect(context.auth?.userId).toBe('user-123');
      expect(context.auth?.sessionId).toBe('session-456');
      expect(context.auth?.scope).toEqual(['read', 'write']);
    });
  });

  describe('MCPRequest', () => {
    it('should support method and optional params', () => {
      const request: MCPRequest = {
        method: 'test-method',
        params: { key: 'value' },
      };

      expect(request.method).toBe('test-method');
      expect(request.params).toEqual({ key: 'value' });
    });

    it('should allow minimal request', () => {
      const request: MCPRequest = {
        method: 'simple-method',
      };

      expect(request.method).toBe('simple-method');
      expect(request.params).toBeUndefined();
    });
  });

  describe('MCPResponse', () => {
    it('should support success response', () => {
      const response: MCPResponse = {
        result: { data: 'success' },
      };

      expect(response.result).toEqual({ data: 'success' });
      expect(response.error).toBeUndefined();
    });

    it('should support error response', () => {
      const response: MCPResponse = {
        error: {
          code: 400,
          message: 'Bad request',
          data: { details: 'Invalid input' },
        },
      };

      expect(response.error?.code).toBe(400);
      expect(response.error?.message).toBe('Bad request');
      expect(response.error?.data).toEqual({ details: 'Invalid input' });
    });
  });

  describe('SecureToolDefinition', () => {
    it('should define tool with required fields', () => {
      const tool: SecureToolDefinition = {
        name: 'test-tool',
        description: 'Test tool description',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        handler: async () => ({ success: true }),
      };

      expect(tool.name).toBe('test-tool');
      expect(tool.description).toBe('Test tool description');
      expect(tool.inputSchema.type).toBe('object');
    });

    it('should support optional security fields', () => {
      const tool: SecureToolDefinition = {
        name: 'secure-tool',
        description: 'Secure tool',
        inputSchema: { type: 'object' },
        handler: async () => ({ success: true }),
        requiredScopes: ['admin', 'write'],
        customAuthCheck: (context) => context.userId.startsWith('admin-'),
      };

      expect(tool.requiredScopes).toEqual(['admin', 'write']);
      expect(tool.customAuthCheck).toBeDefined();
      expect(typeof tool.customAuthCheck).toBe('function');
    });
  });

  describe('SecureMCPServerConfig', () => {
    it('should define required config fields', () => {
      const config: SecureMCPServerConfig = {
        name: 'test-server',
        version: '1.0.0',
        jwtSecret: 'secret-key',
      };

      expect(config.name).toBe('test-server');
      expect(config.version).toBe('1.0.0');
      expect(config.jwtSecret).toBe('secret-key');
    });

    it('should support optional config fields', () => {
      const config: SecureMCPServerConfig = {
        name: 'test-server',
        version: '1.0.0',
        jwtSecret: 'secret-key',
        sessionExpiryMs: 7200000,
        tokenExpirySeconds: 7200,
        rateLimitConfig: {
          windowMs: 60000,
          maxRequests: 100,
        },
        tokenVaultConfig: {
          serviceName: 'custom-service',
          fallbackToMemory: true,
        },
      };

      expect(config.sessionExpiryMs).toBe(7200000);
      expect(config.tokenExpirySeconds).toBe(7200);
      expect(config.rateLimitConfig?.windowMs).toBe(60000);
      expect(config.rateLimitConfig?.maxRequests).toBe(100);
      expect(config.tokenVaultConfig?.serviceName).toBe('custom-service');
      expect(config.tokenVaultConfig?.fallbackToMemory).toBe(true);
    });
  });

  describe('ToolHandler', () => {
    it('should be a function that returns a promise', async () => {
      const handler: ToolHandler = async (params, context) => {
        return { result: 'success' };
      };

      const mockContext: Partial<SecurityContext> = {
        auth: {
          userId: 'user-123',
          sessionId: 'session-456',
          scope: ['read'],
        },
      };

      const result = await handler(
        { input: 'test' },
        mockContext as SecurityContext
      );
      expect(result).toEqual({ result: 'success' });
    });
  });

  describe('MiddlewareFunction', () => {
    it('should transform or pass through requests', async () => {
      const middleware: MiddlewareFunction = async (request, context) => {
        return {
          ...request,
          params: { ...request.params, modified: true },
        };
      };

      const mockContext: Partial<SecurityContext> = {
        auth: {
          userId: 'user-123',
          sessionId: 'session-456',
          scope: ['read'],
        },
      };

      const request: MCPRequest = {
        method: 'test',
        params: { original: true },
      };

      const result = await middleware(request, mockContext as SecurityContext);
      expect(result?.params).toEqual({ original: true, modified: true });
    });

    it('should allow blocking requests by returning null', async () => {
      const blockingMiddleware: MiddlewareFunction = async (request, context) => {
        if (request.method === 'blocked-method') {
          return null;
        }
        return request;
      };

      const mockContext: Partial<SecurityContext> = {
        auth: {
          userId: 'user-123',
          sessionId: 'session-456',
          scope: ['read'],
        },
      };

      const blockedRequest: MCPRequest = {
        method: 'blocked-method',
      };

      const result = await blockingMiddleware(
        blockedRequest,
        mockContext as SecurityContext
      );
      expect(result).toBeNull();
    });
  });
});
