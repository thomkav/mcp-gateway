import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from './session-manager.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({
      sessionExpiryMs: 3600000, // 1 hour
    });
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = sessionManager.createSession('user123');

      expect(session).toBeTruthy();
      expect(session.sessionId).toBeTruthy();
      expect(session.userId).toBe('user123');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should create session with metadata', () => {
      const metadata = { role: 'admin', ip: '127.0.0.1' };
      const session = sessionManager.createSession('user123', metadata);

      expect(session.metadata).toEqual(metadata);
    });

    it('should create unique session IDs', () => {
      const session1 = sessionManager.createSession('user123');
      const session2 = sessionManager.createSession('user123');

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('verifySession', () => {
    it('should verify a valid session', () => {
      const session = sessionManager.createSession('user123');
      const result = sessionManager.verifySession(session.sessionId);

      expect(result.valid).toBe(true);
      expect(result.session).toEqual(session);
    });

    it('should reject non-existent session', () => {
      const result = sessionManager.verifySession('nonexistent-session-id');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should reject expired session', async () => {
      const shortLivedManager = new SessionManager({
        sessionExpiryMs: 100,
      });

      const session = shortLivedManager.createSession('user123');
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = shortLivedManager.verifySession(session.sessionId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session expired');

      shortLivedManager.destroy();
    });
  });

  describe('getSession', () => {
    it('should retrieve a valid session', () => {
      const created = sessionManager.createSession('user123');
      const retrieved = sessionManager.getSession(created.sessionId);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for invalid session', () => {
      const retrieved = sessionManager.getSession('invalid-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getUserSessions', () => {
    it('should get all sessions for a user', () => {
      sessionManager.createSession('user123');
      sessionManager.createSession('user123');
      sessionManager.createSession('user456');

      const sessions = sessionManager.getUserSessions('user123');
      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.userId === 'user123')).toBe(true);
    });

    it('should exclude expired sessions', async () => {
      const shortLivedManager = new SessionManager({
        sessionExpiryMs: 100,
      });

      shortLivedManager.createSession('user123');
      await new Promise((resolve) => setTimeout(resolve, 150));
      shortLivedManager.createSession('user123');

      const sessions = shortLivedManager.getUserSessions('user123');
      expect(sessions).toHaveLength(1);

      shortLivedManager.destroy();
    });
  });

  describe('extendSession', () => {
    it('should extend session expiry', () => {
      const session = sessionManager.createSession('user123');
      const originalExpiry = session.expiresAt;

      const result = sessionManager.extendSession(session.sessionId, 1000);

      expect(result).toBe(true);
      const updated = sessionManager.getSession(session.sessionId);
      expect(updated?.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });

    it('should return false for non-existent session', () => {
      const result = sessionManager.extendSession('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('destroySession', () => {
    it('should destroy a session', () => {
      const session = sessionManager.createSession('user123');
      const result = sessionManager.destroySession(session.sessionId);

      expect(result).toBe(true);
      expect(sessionManager.getSession(session.sessionId)).toBeUndefined();
    });

    it('should return false for non-existent session', () => {
      const result = sessionManager.destroySession('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('destroyUserSessions', () => {
    it('should destroy all sessions for a user', () => {
      sessionManager.createSession('user123');
      sessionManager.createSession('user123');
      sessionManager.createSession('user456');

      const count = sessionManager.destroyUserSessions('user123');

      expect(count).toBe(2);
      expect(sessionManager.getUserSessions('user123')).toHaveLength(0);
      expect(sessionManager.getUserSessions('user456')).toHaveLength(1);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      const shortLivedManager = new SessionManager({
        sessionExpiryMs: 100,
      });

      shortLivedManager.createSession('user123');
      shortLivedManager.createSession('user456');

      await new Promise((resolve) => setTimeout(resolve, 150));
      shortLivedManager.createSession('user789');

      const cleaned = shortLivedManager.cleanupExpiredSessions();

      expect(cleaned).toBe(2);
      expect(shortLivedManager.getActiveSessionCount()).toBe(1);

      shortLivedManager.destroy();
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return correct count', () => {
      sessionManager.createSession('user123');
      sessionManager.createSession('user456');

      expect(sessionManager.getActiveSessionCount()).toBe(2);
    });
  });

  describe('automatic cleanup', () => {
    it('should automatically cleanup expired sessions', async () => {
      const autoCleanupManager = new SessionManager({
        sessionExpiryMs: 100,
        cleanupIntervalMs: 50,
      });

      autoCleanupManager.createSession('user123');
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(autoCleanupManager.getActiveSessionCount()).toBe(0);

      autoCleanupManager.destroy();
    });
  });
});
