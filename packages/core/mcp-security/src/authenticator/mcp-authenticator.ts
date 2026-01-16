import jwt from 'jsonwebtoken';
import { TokenPayload, TokenVerificationResult } from '../types/index.js';

export interface MCPAuthenticatorConfig {
  secret: string;
  tokenExpirySeconds?: number;
  issuer?: string;
}

/**
 * MCPAuthenticator handles JWT-based authentication for MCP servers
 */
export class MCPAuthenticator {
  private secret: string;
  private tokenExpirySeconds: number;
  private issuer: string;

  constructor(config: MCPAuthenticatorConfig) {
    this.secret = config.secret;
    this.tokenExpirySeconds = config.tokenExpirySeconds ?? 3600; // 1 hour default
    this.issuer = config.issuer ?? 'workspace-hub-mcp';
  }

  /**
   * Issue a new JWT token for a user session
   */
  issueToken(userId: string, sessionId: string, scope: string[] = ['read', 'write']): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      userId,
      sessionId,
      scope,
      iat: now,
      exp: now + this.tokenExpirySeconds,
    };

    return jwt.sign(payload, this.secret, {
      issuer: this.issuer,
    });
  }

  /**
   * Verify a JWT token and return its payload
   */
  verifyToken(token: string): TokenVerificationResult {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer,
      }) as TokenPayload;

      // Additional validation of payload structure
      if (!decoded.userId || !decoded.sessionId || !decoded.scope) {
        return {
          valid: false,
          error: 'Invalid token payload structure',
        };
      }

      return {
        valid: true,
        payload: decoded,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Token expired',
        };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'Invalid token',
        };
      }
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Decode a token without verification (for inspection)
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.decode(token) as TokenPayload | null;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Refresh a token (issue new token with same claims but new expiry)
   */
  refreshToken(token: string): string | null {
    const result = this.verifyToken(token);
    if (!result.valid || !result.payload) {
      return null;
    }

    return this.issueToken(
      result.payload.userId,
      result.payload.sessionId,
      result.payload.scope
    );
  }
}
