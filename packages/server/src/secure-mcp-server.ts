import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  MCPAuthenticator,
  SessionManager,
  RequestVerifier,
  RateLimiter,
  AuditLogger,
} from '@mcp-gateway/core';
import { TokenVault } from '@mcp-gateway/core/storage';
import type { AuthContext } from '@mcp-gateway/core';
import {
  SecureMCPServerConfig,
  SecureToolDefinition,
  SecurityContext,
  MiddlewareFunction,
  MCPRequest,
} from './types.js';

/**
 * SecureMCPServer wraps the MCP SDK Server with integrated security components
 */
export class SecureMCPServer {
  private server: Server;
  private authenticator: MCPAuthenticator;
  private sessionManager: SessionManager;
  private requestVerifier: RequestVerifier;
  private rateLimiter: RateLimiter;
  private auditLogger: AuditLogger;
  private tokenVault: TokenVault;
  private tools: Map<string, SecureToolDefinition> = new Map();
  private middlewares: MiddlewareFunction[] = [];
  private autoAuthToken?: string; // Auto-generated token for stdio mode

  constructor(config: SecureMCPServerConfig) {
    // Initialize security components
    this.authenticator = new MCPAuthenticator({
      secret: config.jwtSecret,
      tokenExpirySeconds: config.tokenExpirySeconds,
      issuer: config.name,
    });

    this.sessionManager = new SessionManager({
      sessionExpiryMs: config.sessionExpiryMs,
      cleanupIntervalMs: 60000, // Cleanup every minute
    });

    this.requestVerifier = new RequestVerifier();
    this.rateLimiter = new RateLimiter(
      config.rateLimitConfig ?? {
        windowMs: 60000,
        maxRequests: 100,
      }
    );
    this.auditLogger = new AuditLogger(config.auditLoggerConfig);
    this.tokenVault = new TokenVault(config.tokenVaultConfig);

    // Auto-auth for stdio transport (local development with full security stack)
    const transport = config.transport || 'stdio';
    if (transport === 'stdio') {
      const userId = config.stdioUserId || process.env.USER || 'local-user';
      const scopes = config.stdioScopes || ['vikunja:read', 'vikunja:write', 'vikunja:delete'];

      const { token, sessionId } = this.createSession(userId, scopes);
      this.autoAuthToken = token;

      console.error('[TRANSPORT] stdio (local mode with auto-authentication)');
      console.error('[AUTH] User:', userId);
      console.error('[AUTH] Session:', sessionId);
      console.error('[AUTH] Scopes:', scopes.join(', '));
      console.error('[AUTH] JWT validation active for all requests');
    } else {
      console.error('[TRANSPORT] http (remote mode - clients must authenticate)');
    }

    // Initialize MCP Server
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up MCP handlers
    this.setupHandlers();
  }

  /**
   * Set up MCP protocol handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Call tool handler with security
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const tool = this.tools.get(toolName);

      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Extract auth token from request
      const token = this.extractToken(request);
      if (!token) {
        throw new Error('Authentication required');
      }

      // Verify token
      const tokenResult = this.authenticator.verifyToken(token);
      if (!tokenResult.valid || !tokenResult.payload) {
        await this.auditLogger.log('tool_call', 'failure', {
          resource: toolName,
          metadata: { error: tokenResult.error },
        });
        throw new Error('Invalid or expired token');
      }

      // Verify session
      const sessionResult = this.sessionManager.verifySession(
        tokenResult.payload.sessionId
      );
      if (!sessionResult.valid) {
        await this.auditLogger.log('tool_call', 'failure', {
          userId: tokenResult.payload.userId,
          sessionId: tokenResult.payload.sessionId,
          resource: toolName,
          metadata: { error: sessionResult.error },
        });
        throw new Error('Invalid or expired session');
      }

      const authContext: AuthContext = {
        userId: tokenResult.payload.userId,
        sessionId: tokenResult.payload.sessionId,
        scope: tokenResult.payload.scope,
      };

      // Check rate limit
      const rateLimitResult = this.rateLimiter.checkLimit(authContext.userId);
      if (!rateLimitResult.allowed) {
        await this.auditLogger.log('tool_call', 'failure', {
          userId: authContext.userId,
          sessionId: authContext.sessionId,
          resource: toolName,
          metadata: { error: 'Rate limit exceeded' },
        });
        throw new Error('Rate limit exceeded');
      }

      // Check authorization for tool
      if (tool.requiredScopes && tool.requiredScopes.length > 0) {
        this.requestVerifier.addRule({
          resource: toolName,
          requiredScopes: tool.requiredScopes,
          customCheck: tool.customAuthCheck,
        });

        const authResult = this.requestVerifier.verify(toolName, authContext);
        if (!authResult.authorized) {
          await this.auditLogger.log('tool_call', 'failure', {
            userId: authContext.userId,
            sessionId: authContext.sessionId,
            resource: toolName,
            metadata: { error: authResult.reason },
          });
          throw new Error(`Authorization failed: ${authResult.reason}`);
        }
      }

      // Create security context
      const securityContext: SecurityContext = {
        auth: authContext,
        tokenVault: this.tokenVault,
      };

      // Run middlewares
      let mcpRequest: MCPRequest = {
        method: toolName,
        params: request.params.arguments,
      };

      for (const middleware of this.middlewares) {
        const result = await middleware(mcpRequest, securityContext);
        if (result === null) {
          await this.auditLogger.log('tool_call', 'failure', {
            userId: authContext.userId,
            sessionId: authContext.sessionId,
            resource: toolName,
            metadata: { error: 'Request blocked by middleware' },
          });
          throw new Error('Request blocked by middleware');
        }
        mcpRequest = result;
      }

      // Execute tool handler
      try {
        const result = await tool.handler(mcpRequest.params, securityContext);

        // Log success
        await this.auditLogger.log('tool_call', 'success', {
          userId: authContext.userId,
          sessionId: authContext.sessionId,
          resource: toolName,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        await this.auditLogger.log('tool_call', 'error', {
          userId: authContext.userId,
          sessionId: authContext.sessionId,
          resource: toolName,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        throw error;
      }
    });
  }

  /**
   * Extract authentication token from request
   */
  private extractToken(request: unknown): string | null {
    // Try to extract token from request params
    const req = request as { params?: { _token?: string } };
    const requestToken = req.params?._token ?? null;

    // If token found in request, use it (remote mode or explicit auth)
    if (requestToken) {
      return requestToken;
    }

    // Fall back to auto-auth token if stdio mode enabled
    if (this.autoAuthToken) {
      return this.autoAuthToken;
    }

    // No token available
    return null;
  }

  /**
   * Register a tool with security requirements
   */
  registerTool(tool: SecureToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Add middleware to the request processing pipeline
   */
  use(middleware: MiddlewareFunction): void {
    this.middlewares.push(middleware);
  }

  /**
   * Create a new user session and return auth token
   */
  createSession(
    userId: string,
    scope: string[] = ['read', 'write'],
    metadata?: Record<string, unknown>
  ): { token: string; sessionId: string } {
    const session = this.sessionManager.createSession(userId, metadata);
    const token = this.authenticator.issueToken(userId, session.sessionId, scope);

    void this.auditLogger.log('session_created', 'success', {
      userId,
      sessionId: session.sessionId,
    });

    return {
      token,
      sessionId: session.sessionId,
    };
  }

  /**
   * Destroy a session
   */
  destroySession(sessionId: string): boolean {
    const result = this.sessionManager.destroySession(sessionId);

    if (result) {
      void this.auditLogger.log('session_destroyed', 'success', {
        sessionId,
      });
    }

    return result;
  }

  /**
   * Get access to the token vault
   */
  getTokenVault(): TokenVault {
    return this.tokenVault;
  }

  /**
   * Get access to the audit logger
   */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  /**
   * Get access to the session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Start the server with stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Stop the server and cleanup
   */
  async stop(): Promise<void> {
    this.sessionManager.destroy();
    await this.server.close();
  }
}
