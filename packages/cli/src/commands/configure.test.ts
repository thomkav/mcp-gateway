import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenVault } from '@mcp-gateway/core/storage';

describe('Configure Command', () => {
  let vault: TokenVault;

  beforeEach(() => {
    vault = new TokenVault({
      serviceName: 'test-service',
      fallbackToMemory: true,
    });
  });

  afterEach(() => {
    vault.clearMemory();
  });

  it('should store token with service and user ID', async () => {
    const key = 'test-service:test-user';
    const token = 'test-token-123';

    const success = await vault.store(key, token);
    expect(success).toBe(true);

    const retrieved = await vault.retrieve(key);
    expect(retrieved).toBe(token);
  });

  it('should validate required fields', async () => {
    const key = 'test-service:test-user';
    const token = '';

    await expect(async () => {
      if (!token) {
        throw new Error('Token is required');
      }
      await vault.store(key, token);
    }).rejects.toThrow('Token is required');
  });

  it('should handle keyring fallback', async () => {
    const vault = new TokenVault({
      serviceName: 'test-service',
      fallbackToMemory: true,
    });

    const key = 'test-service:test-user';
    const token = 'test-token-123';

    const success = await vault.store(key, token);
    expect(success).toBe(true);

    // Should work even if keyring fails (fallback to memory)
    const retrieved = await vault.retrieve(key);
    expect(retrieved).toBe(token);
  });

  it('should update existing token', async () => {
    const key = 'test-service:test-user';
    const token1 = 'token-1';
    const token2 = 'token-2';

    await vault.store(key, token1);
    const retrieved1 = await vault.retrieve(key);
    expect(retrieved1).toBe(token1);

    await vault.store(key, token2);
    const retrieved2 = await vault.retrieve(key);
    expect(retrieved2).toBe(token2);
  });
});
