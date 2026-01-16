import { v4 as uuidv4 } from 'uuid';
import { SessionData, SessionVerificationResult } from '../types/index.js';

export interface SessionManagerConfig {
  sessionExpiryMs?: number;
  cleanupIntervalMs?: number;
}

/**
 * SessionManager handles user session lifecycle management
 */
export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private sessionExpiryMs: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: SessionManagerConfig = {}) {
    this.sessionExpiryMs = config.sessionExpiryMs ?? 3600000; // 1 hour default

    // Start cleanup interval if configured
    if (config.cleanupIntervalMs && config.cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(
        () => this.cleanupExpiredSessions(),
        config.cleanupIntervalMs
      );
    }
  }

  /**
   * Create a new session for a user
   */
  createSession(userId: string, metadata?: Record<string, unknown>): SessionData {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionExpiryMs);

    const session: SessionData = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt,
      metadata,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Verify a session exists and is valid
   */
  verifySession(sessionId: string): SessionVerificationResult {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        valid: false,
        error: 'Session not found',
      };
    }

    const now = new Date();
    if (now > session.expiresAt) {
      this.sessions.delete(sessionId);
      return {
        valid: false,
        error: 'Session expired',
      };
    }

    return {
      valid: true,
      session,
    };
  }

  /**
   * Get session data by session ID
   */
  getSession(sessionId: string): SessionData | undefined {
    const result = this.verifySession(sessionId);
    return result.valid ? result.session : undefined;
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): SessionData[] {
    const now = new Date();
    const sessions: SessionData[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId === userId && now <= session.expiresAt) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Extend a session's expiry time
   */
  extendSession(sessionId: string, additionalMs?: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const extension = additionalMs ?? this.sessionExpiryMs;
    session.expiresAt = new Date(session.expiresAt.getTime() + extension);
    return true;
  }

  /**
   * Destroy a specific session
   */
  destroySession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Destroy all sessions for a user
   */
  destroyUserSessions(userId: string): number {
    let count = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    return count;
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = new Date();
    let count = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        count++;
      }
    }

    return count;
  }

  /**
   * Get total number of active sessions
   */
  getActiveSessionCount(): number {
    this.cleanupExpiredSessions();
    return this.sessions.size;
  }

  /**
   * Destroy all sessions and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.sessions.clear();
  }
}
