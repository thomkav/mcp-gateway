#!/usr/bin/env node

/**
 * Vikunja MCP Server - Local Stdio Mode
 *
 * This is the LOCAL version for stdio transport (Claude Code desktop).
 * For REMOTE deployment, use index.ts (full JWT/session management).
 *
 * Security Model:
 * - Stdio: Process isolation provides security boundary (parent-child relationship)
 * - Vikunja token: Stored in OS keyring (encrypted at rest)
 * - Rate limiting: Local limits (higher than remote)
 * - Audit logging: Error-level only (less noise)
 *
 * Migration Path:
 * When moving to remote:
 * 1. Switch to index.ts (full SecureMCPServer)
 * 2. Add HTTP/WebSocket transport
 * 3. Implement client authentication
 * 4. Lower rate limits for multi-user
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TokenVault } from '@mcp-gateway/core/dist/storage/index.js';
import { vikunjaTools } from './tools.js';
import { VikunjaClient } from './vikunja-client.js';

async function main() {
  // Initialize MCP Server (no JWT for local stdio)
  const server = new Server(
    {
      name: 'vikunja-mcp-server-local',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize token vault for secure Vikunja token storage
  const tokenVault = new TokenVault({
    serviceName: 'mcp-vikunja',
    fallbackToMemory: false, // Fail if keyring unavailable
  });

  // Initialize Vikunja client
  const vikunjaClient = new VikunjaClient();

  // Get local user ID (for keyring lookups)
  const localUserId = process.env.USER || 'local-user';

  // Set up MCP handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: vikunjaTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = vikunjaTools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      // Get Vikunja API token from OS keyring
      const apiToken = await tokenVault.retrieve(`${localUserId}:vikunja`);

      if (!apiToken) {
        throw new Error(
          'Vikunja API token not configured. Token must be stored in OS keyring at: ' +
          `service="mcp-vikunja", account="${localUserId}:vikunja"`
        );
      }

      // Set up authenticated Vikunja client
      vikunjaClient.setToken(apiToken);

      // Execute tool (no complex context needed for local stdio)
      const result = await tool.handler(
        request.params.arguments || {},
        vikunjaClient,
        {} as any // Minimal context for local mode
      );

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ERROR] Tool ${toolName} failed:`, errorMessage);

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Vikunja MCP server (local stdio mode) running');
  console.error(`Local user: ${localUserId}`);
  console.error(`Token location: OS keyring service="mcp-vikunja", account="${localUserId}:vikunja"`);
  console.error('Ready for MCP requests');

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
