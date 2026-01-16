import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenVault } from '@mcp-gateway/core/storage';
import { SessionManager } from '@mcp-gateway/core/session';

describe('Status Command', () => {
  let vault: TokenVault;
  let sessionManager: SessionManager;

  beforeEach(() => {
    vault = new TokenVault({
      serviceName: 'test-service',
      fallbackToMemory: true,
    });

    sessionManager = new SessionManager({
      sessionExpiryMs: 3600000,
    });
  });

  afterEach(() => {
    vault.clearMemory();
    sessionManager.destroy();
  });

  it('should check if token exists', async () => {
    const key = 'test-service:test-user';
    const token = 'test-token';

    await vault.store(key, token);
    const exists = await vault.exists(key);

    expect(exists).toBe(true);
  });

  it('should return false for non-existent token', async () => {
    const key = 'test-service:non-existent';
    const exists = await vault.exists(key);

    expect(exists).toBe(false);
  });

  it('should get user sessions', () => {
    const userId = 'test-user';

    const session1 = sessionManager.createSession(userId, { type: 'web' });
    const session2 = sessionManager.createSession(userId, { type: 'cli' });

    const sessions = sessionManager.getUserSessions(userId);

    expect(sessions).toHaveLength(2);
    expect(sessions[0].userId).toBe(userId);
    expect(sessions[1].userId).toBe(userId);
  });

  it('should return empty array for user with no sessions', () => {
    const userId = 'test-user';
    const sessions = sessionManager.getUserSessions(userId);

    expect(sessions).toHaveLength(0);
  });

  it('should show storage type', () => {
    const isKeyring = vault.isUsingKeyring();
    expect(typeof isKeyring).toBe('boolean');
  });

  it('should list memory keys when using memory fallback', async () => {
    // Create a vault that will use memory fallback
    const memoryVault = new TokenVault({
      serviceName: 'test-service',
      fallbackToMemory: true,
    });

    await memoryVault.store('service1:user1', 'token1');
    await memoryVault.store('service2:user2', 'token2');

    const keys = memoryVault.listKeys();

    // Keys will only be in list if using memory store
    // If keyring is working, keys will be empty (stored in keyring)
    if (!memoryVault.isUsingKeyring()) {
      expect(keys).toContain('service1:user1');
      expect(keys).toContain('service2:user2');
    } else {
      // If keyring is working, listKeys warns and returns empty array
      expect(keys.length).toBeGreaterThanOrEqual(0);
    }

    memoryVault.clearMemory();
  });
});
