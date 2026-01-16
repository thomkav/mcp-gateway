#!/usr/bin/env node

/**
 * Stdio Proxy for SecureMCPServer
 *
 * Purpose: Enable local testing of the full JWT/session architecture via stdio.
 *
 * Architecture:
 *   Claude Code (stdio, no auth)
 *     → Stdio Proxy (injects JWT)
 *     → SecureMCPServer (validates JWT)
 *     → Vikunja API
 *
 * How it works:
 * 1. Creates a long-lived session on startup
 * 2. Intercepts MCP protocol messages via stdio
 * 3. Injects JWT token into request metadata
 * 4. Forwards to SecureMCPServer's internal handler
 * 5. Returns response via stdio
 *
 * Migration to Remote:
 * - Remove this proxy
 * - Use index.ts directly with HTTP/WebSocket transport
 * - Clients get their own JWT tokens via authentication endpoint
 */

import { createInterface } from 'readline';
import { SecureMCPServer } from '@mcp-gateway/server';
import { VikunjaClient } from './vikunja-client.js';
import { vikunjaTools } from './tools.js';

async function main() {
  const JWT_SECRET = process.env.MCP_JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('MCP_JWT_SECRET environment variable is required');
  }

  // Initialize the full secure MCP server (with JWT/sessions)
  const server = new SecureMCPServer({
    name: 'vikunja-mcp-server',
    version: '1.0.0',
    jwtSecret: JWT_SECRET,
    sessionExpiryMs: 365 * 24 * 60 * 60 * 1000, // 1 year for local testing
    tokenExpirySeconds: 365 * 24 * 60 * 60, // 1 year for local testing
    rateLimitConfig: {
      windowMs: 60000,
      maxRequests: 1000, // Higher for local
    },
    tokenVaultConfig: {
      serviceName: 'mcp-vikunja',
      fallbackToMemory: false,
    },
    auditLoggerConfig: {
      maxEntries: 10000,
      onLog: async (entry) => {
        // Log errors only to reduce noise
        if (entry.result !== 'success') {
          console.error(
            `[AUDIT] ${entry.timestamp.toISOString()} | ${entry.action} | ${entry.result} | ` +
            `user=${entry.userId} | resource=${entry.resource}`
          );
        }
      },
    },
  });

  const vikunjaClient = new VikunjaClient();

  // Register all tools
  for (const tool of vikunjaTools) {
    server.registerTool({
      ...tool,
      handler: async (params, context) => {
        const apiToken = await context.tokenVault.getToken(
          context.auth.userId,
          'vikunja'
        );

        if (!apiToken) {
          throw new Error('Vikunja API token not configured in OS keyring');
        }

        vikunjaClient.setToken(apiToken);
        return tool.handler(params, vikunjaClient, context);
      },
    });
  }

  // Add validation middleware
  server.use(async (request, context) => {
    if (request.params && typeof request.params === 'object') {
      const params = request.params as Record<string, unknown>;
      const numericFields = ['projectId', 'taskId', 'bucketId', 'viewId'];

      for (const field of numericFields) {
        if (field in params && typeof params[field] === 'number') {
          const value = params[field] as number;
          if (value <= 0 || !Number.isInteger(value)) {
            throw new Error(`${field} must be a positive integer`);
          }
        }
      }

      if ('page' in params && typeof params.page === 'number' && params.page < 1) {
        throw new Error('page must be >= 1');
      }
      if ('per_page' in params && typeof params.per_page === 'number') {
        if (params.per_page < 1 || params.per_page > 100) {
          throw new Error('per_page must be between 1 and 100');
        }
      }
    }
    return request;
  });

  // Create local session (simulates authenticated user)
  const localUserId = process.env.USER || 'local-user';
  const { token: jwtToken, sessionId } = server.createSession(
    localUserId,
    ['vikunja:read', 'vikunja:write', 'vikunja:delete']
  );

  console.error('═══════════════════════════════════════════════════════');
  console.error('Vikunja MCP Server - Stdio Proxy Mode');
  console.error('═══════════════════════════════════════════════════════');
  console.error(`Local User: ${localUserId}`);
  console.error(`Session ID: ${sessionId}`);
  console.error(`JWT Token: ${jwtToken.substring(0, 20)}...`);
  console.error('Architecture: stdio → proxy (JWT injection) → SecureMCPServer');
  console.error('Keyring: service=mcp-vikunja, account=' + localUserId + ':vikunja');
  console.error('Ready for MCP protocol messages');
  console.error('═══════════════════════════════════════════════════════');

  // Stdio proxy: Intercept MCP messages and inject JWT token
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    try {
      const message = JSON.parse(line);

      // Inject JWT token into request metadata
      // The SecureMCPServer's extractToken method looks for _token in params
      if (message.method === 'tools/call' && message.params) {
        message.params._token = jwtToken;
      }

      // TODO: Forward to SecureMCPServer's handler
      // For now, we need to figure out how to invoke the server's handler
      // The SecureMCPServer uses @modelcontextprotocol/sdk internally
      // We need to access its request handler

      console.error('[PROXY] Received:', message.method);

      // Temporary response until we wire up the handler
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Stdio proxy not fully implemented yet - handler wiring needed',
        },
      };

      console.log(JSON.stringify(response));

    } catch (error) {
      console.error('[PROXY ERROR]', error);
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      };
      console.log(JSON.stringify(errorResponse));
    }
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down stdio proxy...');
    rl.close();
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
