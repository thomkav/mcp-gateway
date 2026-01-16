import { describe, it, expect, beforeEach } from 'vitest';
import { MCPAuthenticator } from './mcp-authenticator.js';

describe('MCPAuthenticator', () => {
  let authenticator: MCPAuthenticator;

  beforeEach(() => {
    authenticator = new MCPAuthenticator({
      secret: 'test-secret-key-12345',
      tokenExpirySeconds: 3600,
      issuer: 'test-issuer',
    });
  });

  describe('issueToken', () => {
    it('should issue a valid token', () => {
      const token = authenticator.issueToken('user123', 'session456', ['read', 'write']);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should include correct payload data', () => {
      const token = authenticator.issueToken('user123', 'session456', ['read']);
      const decoded = authenticator.decodeToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe('user123');
      expect(decoded?.sessionId).toBe('session456');
      expect(decoded?.scope).toEqual(['read']);
    });

    it('should use default scopes if not provided', () => {
      const token = authenticator.issueToken('user123', 'session456');
      const decoded = authenticator.decodeToken(token);

      expect(decoded?.scope).toEqual(['read', 'write']);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = authenticator.issueToken('user123', 'session456');
      const result = authenticator.verifyToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeTruthy();
      expect(result.payload?.userId).toBe('user123');
    });

    it('should reject an invalid token', () => {
      const result = authenticator.verifyToken('invalid.token.here');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject a token with wrong signature', () => {
      const token = authenticator.issueToken('user123', 'session456');
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      const result = authenticator.verifyToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject an expired token', async () => {
      const shortLivedAuth = new MCPAuthenticator({
        secret: 'test-secret',
        tokenExpirySeconds: 1,
      });

      const token = shortLivedAuth.issueToken('user123', 'session456');

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = shortLivedAuth.verifyToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should reject token from different issuer', () => {
      const token = authenticator.issueToken('user123', 'session456');
      const otherAuth = new MCPAuthenticator({
        secret: 'test-secret-key-12345',
        issuer: 'different-issuer',
      });

      const result = otherAuth.verifyToken(token);
      expect(result.valid).toBe(false);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = authenticator.issueToken('user123', 'session456');
      const decoded = authenticator.decodeToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe('user123');
    });

    it('should return null for invalid token', () => {
      const decoded = authenticator.decodeToken('not.a.valid.token');
      expect(decoded).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh a valid token', async () => {
      const originalToken = authenticator.issueToken('user123', 'session456', ['read']);

      // Wait to ensure different timestamps (1 second to be safe)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const newToken = authenticator.refreshToken(originalToken);

      expect(newToken).toBeTruthy();

      // Tokens should have different iat/exp times
      const originalDecoded = authenticator.decodeToken(originalToken);
      const newDecoded = authenticator.decodeToken(newToken!);

      expect(newDecoded?.userId).toBe('user123');
      expect(newDecoded?.sessionId).toBe('session456');
      expect(newDecoded?.scope).toEqual(['read']);
      expect(newDecoded?.iat).toBeGreaterThan(originalDecoded?.iat ?? 0);
    });

    it('should return null for invalid token', () => {
      const result = authenticator.refreshToken('invalid.token');
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const shortLivedAuth = new MCPAuthenticator({
        secret: 'test-secret',
        tokenExpirySeconds: 1,
      });

      const token = shortLivedAuth.issueToken('user123', 'session456');
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const refreshed = shortLivedAuth.refreshToken(token);
      expect(refreshed).toBeNull();
    });
  });
});
