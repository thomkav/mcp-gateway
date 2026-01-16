import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000,
      maxRequests: 3,
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('checkLimit', () => {
    it('should allow requests under the limit', () => {
      const result1 = rateLimiter.checkLimit('user123');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = rateLimiter.checkLimit('user123');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = rateLimiter.checkLimit('user123');
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests over the limit', () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user123');

      const result = rateLimiter.checkLimit('user123');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different keys independently', () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user123');

      const result = rateLimiter.checkLimit('user456');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should reset after window expires', async () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user123');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = rateLimiter.checkLimit('user123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should provide correct resetAt timestamp', () => {
      const before = Date.now();
      const result = rateLimiter.checkLimit('user123');
      const after = Date.now();

      expect(result.resetAt).toBeGreaterThanOrEqual(before + 1000);
      expect(result.resetAt).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('reset', () => {
    it('should reset limit for a key', () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user123');

      const reset = rateLimiter.reset('user123');
      expect(reset).toBe(true);

      const result = rateLimiter.checkLimit('user123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should return false for non-existent key', () => {
      const reset = rateLimiter.reset('nonexistent');
      expect(reset).toBe(false);
    });
  });

  describe('getCount', () => {
    it('should return current count for a key', () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user123');

      expect(rateLimiter.getCount('user123')).toBe(2);
    });

    it('should return 0 for non-existent key', () => {
      expect(rateLimiter.getCount('nonexistent')).toBe(0);
    });

    it('should return 0 for expired entry', async () => {
      rateLimiter.checkLimit('user123');
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(rateLimiter.getCount('user123')).toBe(0);
    });
  });

  describe('getTrackedKeysCount', () => {
    it('should return number of tracked keys', () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user456');
      rateLimiter.checkLimit('user789');

      expect(rateLimiter.getTrackedKeysCount()).toBe(3);
    });
  });

  describe('clear', () => {
    it('should clear all rate limit data', () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user456');

      rateLimiter.clear();

      expect(rateLimiter.getTrackedKeysCount()).toBe(0);
    });
  });

  describe('automatic cleanup', () => {
    it('should automatically cleanup expired entries', async () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.checkLimit('user456');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(rateLimiter.getTrackedKeysCount()).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should cleanup and stop intervals', () => {
      rateLimiter.checkLimit('user123');
      rateLimiter.destroy();

      expect(rateLimiter.getTrackedKeysCount()).toBe(0);
    });
  });
});
