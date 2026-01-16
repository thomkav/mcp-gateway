import { describe, it, expect, beforeEach } from 'vitest';
import { RequestVerifier } from './request-verifier.js';
import type { AuthContext } from '../types/index.js';

describe('RequestVerifier', () => {
  let verifier: RequestVerifier;
  let context: AuthContext;

  beforeEach(() => {
    verifier = new RequestVerifier();
    context = {
      userId: 'user123',
      sessionId: 'session456',
      scope: ['read', 'write'],
    };
  });

  describe('addRule and verify', () => {
    it('should allow access when scopes match', () => {
      verifier.addRule({
        resource: 'projects',
        requiredScopes: ['read'],
      });

      const result = verifier.verify('projects', context);
      expect(result.authorized).toBe(true);
    });

    it('should deny access when scopes are missing', () => {
      verifier.addRule({
        resource: 'admin',
        requiredScopes: ['admin'],
      });

      const result = verifier.verify('admin', context);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('Missing required scopes');
    });

    it('should deny access when no rule exists', () => {
      const result = verifier.verify('unknown-resource', context);
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('No authorization rule defined for resource');
    });

    it('should verify multiple required scopes', () => {
      verifier.addRule({
        resource: 'sensitive-data',
        requiredScopes: ['read', 'write'],
      });

      const result = verifier.verify('sensitive-data', context);
      expect(result.authorized).toBe(true);
    });

    it('should apply custom check', () => {
      verifier.addRule({
        resource: 'user-data',
        requiredScopes: ['read'],
        customCheck: (ctx) => ctx.userId === 'user123',
      });

      const result1 = verifier.verify('user-data', context);
      expect(result1.authorized).toBe(true);

      const result2 = verifier.verify('user-data', { ...context, userId: 'user999' });
      expect(result2.authorized).toBe(false);
      expect(result2.reason).toBe('Custom authorization check failed');
    });
  });

  describe('removeRule', () => {
    it('should remove a rule', () => {
      verifier.addRule({
        resource: 'test',
        requiredScopes: ['read'],
      });

      const removed = verifier.removeRule('test');
      expect(removed).toBe(true);

      const result = verifier.verify('test', context);
      expect(result.authorized).toBe(false);
    });

    it('should return false when removing non-existent rule', () => {
      const removed = verifier.removeRule('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('hasScope', () => {
    it('should return true when scope exists', () => {
      expect(verifier.hasScope(context, 'read')).toBe(true);
      expect(verifier.hasScope(context, 'write')).toBe(true);
    });

    it('should return false when scope does not exist', () => {
      expect(verifier.hasScope(context, 'admin')).toBe(false);
    });
  });

  describe('hasAllScopes', () => {
    it('should return true when all scopes exist', () => {
      expect(verifier.hasAllScopes(context, ['read', 'write'])).toBe(true);
    });

    it('should return false when any scope is missing', () => {
      expect(verifier.hasAllScopes(context, ['read', 'admin'])).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(verifier.hasAllScopes(context, [])).toBe(true);
    });
  });

  describe('hasAnyScope', () => {
    it('should return true when at least one scope exists', () => {
      expect(verifier.hasAnyScope(context, ['read', 'admin'])).toBe(true);
    });

    it('should return false when no scopes exist', () => {
      expect(verifier.hasAnyScope(context, ['admin', 'superuser'])).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(verifier.hasAnyScope(context, [])).toBe(false);
    });
  });

  describe('getRules', () => {
    it('should return all rules', () => {
      verifier.addRule({ resource: 'resource1', requiredScopes: ['read'] });
      verifier.addRule({ resource: 'resource2', requiredScopes: ['write'] });

      const rules = verifier.getRules();
      expect(rules).toHaveLength(2);
    });
  });

  describe('clearRules', () => {
    it('should clear all rules', () => {
      verifier.addRule({ resource: 'resource1', requiredScopes: ['read'] });
      verifier.addRule({ resource: 'resource2', requiredScopes: ['write'] });

      verifier.clearRules();

      expect(verifier.getRules()).toHaveLength(0);
    });
  });
});
