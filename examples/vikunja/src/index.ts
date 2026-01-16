#!/usr/bin/env node

import { SecureMCPServer } from '@mcp-gateway/server';
import { z } from 'zod';
import { vikunjaTools } from './tools.js';
import { VikunjaClient } from './vikunja-client.js';

/**
 * Secure Vikunja MCP Server Example
 *
 * This example demonstrates a production-ready secure MCP server for Vikunja
 * task management integration with:
 * - Authentication and session management
 * - Authorization with scope-based access control
 * - Rate limiting
 * - Audit logging
 * - Secure token storage in OS keyring
 */

async function main() {
  // Get configuration from environment
  const JWT_SECRET = process.env.MCP_JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('MCP_JWT_SECRET environment variable is required');
  }

  // Initialize secure MCP server
  const server = new SecureMCPServer({
    name: 'vikunja-mcp-server',
    version: '1.0.0',
    jwtSecret: JWT_SECRET,
    sessionExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
    tokenExpirySeconds: 3600, // 1 hour
    rateLimitConfig: {
      windowMs: 60000, // 1 minute
      maxRequests: 60, // 60 requests per minute
    },
    tokenVaultConfig: {
      serviceName: 'mcp-vikunja',
      fallbackToMemory: false, // Don't fallback - fail if keyring unavailable
    },
  });

  // Initialize Vikunja client
  const vikunjaClient = new VikunjaClient();

  // Register all tools
  for (const tool of vikunjaTools) {
    server.registerTool({
      ...tool,
      handler: async (params, context) => {
        // Get Vikunja API token from secure vault
        const apiToken = await context.tokenVault.getToken(
          context.auth.userId,
          'vikunja'
        );

        if (!apiToken) {
          throw new Error(
            'Vikunja API token not configured. Run: mcp-gateway configure'
          );
        }

        // Set up authenticated Vikunja client
        vikunjaClient.setToken(apiToken);

        // Execute tool with authenticated client
        return tool.handler(params, vikunjaClient, context);
      },
    });
  }

  // Add request logging middleware
  server.use(async (request, context) => {
    console.error(
      `[${new Date().toISOString()}] ${context.auth.userId} - ${request.method}`
    );
    return request;
  });

  // Start server
  console.error('Starting Vikunja MCP server...');
  await server.start();
  console.error('Vikunja MCP server running');

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
