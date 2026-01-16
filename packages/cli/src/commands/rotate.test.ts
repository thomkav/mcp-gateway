import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '@mcp-gateway/core/session';
import { TokenVault } from '@mcp-gateway/core/storage';

describe('Rotate Command', () => {
  let sessionManager: SessionManager;
  let vault: TokenVault;

  beforeEach(() => {
    sessionManager = new SessionManager({
      sessionExpiryMs: 3600000,
    });

    vault = new TokenVault({
      serviceName: 'test-service',
      fallbackToMemory: true,
    });
  });

  afterEach(() => {
    sessionManager.destroy();
    vault.clearMemory();
  });

  it('should create new session', () => {
    const userId = 'test-user';
    const session = sessionManager.createSession(userId, {
      rotatedAt: new Date().toISOString(),
    });

    expect(session.userId).toBe(userId);
    expect(session.sessionId).toBeTruthy();
    expect(session.metadata?.rotatedAt).toBeTruthy();
  });

  it('should destroy all user sessions', () => {
    const userId = 'test-user';

    sessionManager.createSession(userId);
    sessionManager.createSession(userId);
    sessionManager.createSession(userId);

    const beforeCount = sessionManager.getUserSessions(userId).length;
    expect(beforeCount).toBe(3);

    const destroyedCount = sessionManager.destroyUserSessions(userId);
    expect(destroyedCount).toBe(3);

    const afterCount = sessionManager.getUserSessions(userId).length;
    expect(afterCount).toBe(0);
  });

  it('should rotate session (destroy old, create new)', () => {
    const userId = 'test-user';

    const oldSession = sessionManager.createSession(userId);
    const oldSessionId = oldSession.sessionId;

    // Destroy old sessions
    const destroyedCount = sessionManager.destroyUserSessions(userId);
    expect(destroyedCount).toBe(1);

    // Create new session
    const newSession = sessionManager.createSession(userId, {
      rotatedAt: new Date().toISOString(),
    });

    expect(newSession.sessionId).not.toBe(oldSessionId);
    expect(newSession.userId).toBe(userId);

    const sessions = sessionManager.getUserSessions(userId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe(newSession.sessionId);
  });

  it('should update token during rotation', async () => {
    const key = 'test-service:test-user';
    const oldToken = 'old-token';
    const newToken = 'new-token';

    await vault.store(key, oldToken);
    expect(await vault.retrieve(key)).toBe(oldToken);

    // Simulate token rotation
    await vault.store(key, newToken);
    expect(await vault.retrieve(key)).toBe(newToken);
  });

  it('should preserve metadata in rotated session', () => {
    const userId = 'test-user';
    const metadata = {
      rotatedAt: new Date().toISOString(),
      previousSessionCount: 1,
      reason: 'manual-rotation',
    };

    const session = sessionManager.createSession(userId, metadata);

    expect(session.metadata).toEqual(metadata);
    expect(session.metadata?.rotatedAt).toBeTruthy();
    expect(session.metadata?.previousSessionCount).toBe(1);
  });
});
