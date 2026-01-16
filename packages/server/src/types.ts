import { AuthContext } from '@mcp-gateway/core';
import { TokenVault } from '@mcp-gateway/core/storage';

/**
 * Security context passed to tool handlers
 */
export interface SecurityContext {
  auth: AuthContext;
  tokenVault: TokenVault;
}

/**
 * Middleware function type for request processing
 */
export interface MiddlewareFunction {
  (request: MCPRequest, context: SecurityContext): Promise<MCPRequest | null>;
}

/**
 * MCP Request structure (simplified)
 */
export interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * MCP Response structure (simplified)
 */
export interface MCPResponse {
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Tool handler function type
 */
export interface ToolHandler {
  (params: unknown, context: SecurityContext): Promise<unknown>;
}

/**
 * Tool definition with security requirements
 */
export interface SecureToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
  requiredScopes?: string[];
  customAuthCheck?: (context: AuthContext) => boolean;
}

/**
 * Server configuration
 */
export interface SecureMCPServerConfig {
  name: string;
  version: string;
  jwtSecret: string;
  sessionExpiryMs?: number;
  tokenExpirySeconds?: number;
  rateLimitConfig?: {
    windowMs: number;
    maxRequests: number;
  };
  tokenVaultConfig?: {
    serviceName?: string;
    fallbackToMemory?: boolean;
  };
}
