import { AuditLogEntry, SecurityEventType } from '../types/index.js';

export interface AuditLoggerConfig {
  maxEntries?: number;
  onLog?: (entry: AuditLogEntry) => void | Promise<void>;
}

/**
 * AuditLogger records security events for compliance and debugging
 */
export class AuditLogger {
  private entries: AuditLogEntry[] = [];
  private maxEntries: number;
  private onLog?: (entry: AuditLogEntry) => void | Promise<void>;

  constructor(config: AuditLoggerConfig = {}) {
    this.maxEntries = config.maxEntries ?? 10000;
    this.onLog = config.onLog;
  }

  /**
   * Log a security event
   */
  async log(
    action: SecurityEventType | string,
    result: 'success' | 'failure' | 'error',
    details?: {
      userId?: string;
      sessionId?: string;
      resource?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      action,
      result,
      userId: details?.userId,
      sessionId: details?.sessionId,
      resource: details?.resource,
      metadata: details?.metadata,
    };

    this.entries.push(entry);

    // Trim if exceeds max
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Call external logger if configured
    if (this.onLog) {
      try {
        await this.onLog(entry);
      } catch (error) {
        // Silently fail to prevent logging from breaking application
        console.error('Audit log callback failed:', error);
      }
    }
  }

  /**
   * Log successful authentication
   */
  async logAuthSuccess(userId: string, sessionId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log(SecurityEventType.TOKEN_VERIFIED, 'success', {
      userId,
      sessionId,
      metadata,
    });
  }

  /**
   * Log failed authentication
   */
  async logAuthFailure(reason: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log(SecurityEventType.TOKEN_INVALID, 'failure', {
      metadata: { reason, ...metadata },
    });
  }

  /**
   * Log authorization check
   */
  async logAuthorizationCheck(
    userId: string,
    sessionId: string,
    resource: string,
    result: 'success' | 'failure',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const action = result === 'success'
      ? SecurityEventType.AUTHORIZATION_SUCCEEDED
      : SecurityEventType.AUTHORIZATION_FAILED;

    await this.log(action, result, {
      userId,
      sessionId,
      resource,
      metadata,
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(key: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log(SecurityEventType.RATE_LIMIT_EXCEEDED, 'failure', {
      metadata: { key, ...metadata },
    });
  }

  /**
   * Get recent entries
   */
  getRecentEntries(count: number = 100): AuditLogEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get entries for a specific user
   */
  getUserEntries(userId: string, count: number = 100): AuditLogEntry[] {
    return this.entries
      .filter((entry) => entry.userId === userId)
      .slice(-count);
  }

  /**
   * Get entries for a specific action
   */
  getActionEntries(action: string, count: number = 100): AuditLogEntry[] {
    return this.entries
      .filter((entry) => entry.action === action)
      .slice(-count);
  }

  /**
   * Get failed entries
   */
  getFailedEntries(count: number = 100): AuditLogEntry[] {
    return this.entries
      .filter((entry) => entry.result === 'failure' || entry.result === 'error')
      .slice(-count);
  }

  /**
   * Get total number of entries
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Export all entries
   */
  exportEntries(): AuditLogEntry[] {
    return [...this.entries];
  }
}
