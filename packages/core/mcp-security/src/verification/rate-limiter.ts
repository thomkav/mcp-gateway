import { RateLimitConfig } from '../types/index.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * RateLimiter implements token bucket rate limiting
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Cleanup expired entries every window period
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      config.windowMs
    );
  }

  /**
   * Check if a request should be allowed for a given key (e.g., userId or IP)
   */
  checkLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // No entry exists, create one
    if (!entry) {
      const resetAt = now + this.config.windowMs;
      this.limits.set(key, {
        count: 1,
        resetAt,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt,
      };
    }

    // Entry expired, reset
    if (now >= entry.resetAt) {
      const resetAt = now + this.config.windowMs;
      entry.count = 1;
      entry.resetAt = resetAt;
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt,
      };
    }

    // Entry valid, check limit
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    // Increment and allow
    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): boolean {
    return this.limits.delete(key);
  }

  /**
   * Get current count for a key
   */
  getCount(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || Date.now() >= entry.resetAt) {
      return 0;
    }
    return entry.count;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Get number of tracked keys
   */
  getTrackedKeysCount(): number {
    return this.limits.size;
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.limits.clear();
  }

  /**
   * Destroy the rate limiter and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.limits.clear();
  }
}
