#!/usr/bin/env node

import { SecureMCPServer } from '@mcp-gateway/server';

/**
 * Minimal MCP Gateway Example
 *
 * This is the simplest possible secure MCP server using MCP Gateway.
 * It demonstrates:
 * - Basic server setup
 * - A single tool with authentication
 * - Session management
 */

async function main() {
  // Create secure server with minimal config
  const server = new SecureMCPServer({
    name: 'minimal-server',
    version: '1.0.0',
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  });

  // Register a simple tool
  server.registerTool({
    name: 'hello',
    description: 'Returns a greeting message',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name to greet',
        },
      },
      required: ['name'],
    },
    handler: async (params, context) => {
      const { name } = params as { name: string };
      return {
        message: `Hello, ${name}!`,
        userId: context.auth.userId,
        sessionId: context.auth.sessionId,
      };
    },
  });

  // Create a session (in production, this would be done via authentication flow)
  const { token, sessionId } = server.createSession('user-123', ['read', 'write']);
  console.error('Session created:');
  console.error(`  User ID: user-123`);
  console.error(`  Session ID: ${sessionId}`);
  console.error(`  Token: ${token.substring(0, 20)}...`);

  // Start server
  console.error('\nStarting server...');
  await server.start();
  console.error('Server running - press Ctrl+C to stop');

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
