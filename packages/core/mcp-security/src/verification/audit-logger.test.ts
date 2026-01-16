import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger } from './audit-logger.js';
import { SecurityEventType } from '../types/index.js';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe('log', () => {
    it('should log an entry', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success', {
        userId: 'user123',
        sessionId: 'session456',
      });

      const entries = logger.getRecentEntries(1);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.action).toBe(SecurityEventType.TOKEN_VERIFIED);
      expect(entries[0]?.result).toBe('success');
      expect(entries[0]?.userId).toBe('user123');
    });

    it('should call external logger callback', async () => {
      const onLog = vi.fn();
      const callbackLogger = new AuditLogger({ onLog });

      await callbackLogger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      expect(onLog).toHaveBeenCalledOnce();
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: SecurityEventType.TOKEN_VERIFIED,
          result: 'success',
        })
      );
    });

    it('should handle callback errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onLog = vi.fn().mockRejectedValue(new Error('Callback failed'));
      const callbackLogger = new AuditLogger({ onLog });

      await callbackLogger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should respect maxEntries limit', async () => {
      const smallLogger = new AuditLogger({ maxEntries: 3 });

      await smallLogger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await smallLogger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await smallLogger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await smallLogger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      expect(smallLogger.getEntryCount()).toBe(3);
    });
  });

  describe('logAuthSuccess', () => {
    it('should log successful authentication', async () => {
      await logger.logAuthSuccess('user123', 'session456', { ip: '127.0.0.1' });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.action).toBe(SecurityEventType.TOKEN_VERIFIED);
      expect(entries[0]?.result).toBe('success');
      expect(entries[0]?.userId).toBe('user123');
      expect(entries[0]?.sessionId).toBe('session456');
    });
  });

  describe('logAuthFailure', () => {
    it('should log failed authentication', async () => {
      await logger.logAuthFailure('Invalid credentials');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.action).toBe(SecurityEventType.TOKEN_INVALID);
      expect(entries[0]?.result).toBe('failure');
      expect(entries[0]?.metadata?.reason).toBe('Invalid credentials');
    });
  });

  describe('logAuthorizationCheck', () => {
    it('should log successful authorization', async () => {
      await logger.logAuthorizationCheck('user123', 'session456', 'projects', 'success');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.action).toBe(SecurityEventType.AUTHORIZATION_SUCCEEDED);
      expect(entries[0]?.result).toBe('success');
      expect(entries[0]?.resource).toBe('projects');
    });

    it('should log failed authorization', async () => {
      await logger.logAuthorizationCheck('user123', 'session456', 'admin', 'failure');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.action).toBe(SecurityEventType.AUTHORIZATION_FAILED);
      expect(entries[0]?.result).toBe('failure');
    });
  });

  describe('logRateLimitExceeded', () => {
    it('should log rate limit exceeded', async () => {
      await logger.logRateLimitExceeded('user123', { limit: 100 });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.action).toBe(SecurityEventType.RATE_LIMIT_EXCEEDED);
      expect(entries[0]?.result).toBe('failure');
      expect(entries[0]?.metadata?.key).toBe('user123');
    });
  });

  describe('getRecentEntries', () => {
    it('should return recent entries', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      const entries = logger.getRecentEntries(2);
      expect(entries).toHaveLength(2);
    });

    it('should return all entries if count exceeds total', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      const entries = logger.getRecentEntries(100);
      expect(entries).toHaveLength(2);
    });
  });

  describe('getUserEntries', () => {
    it('should return entries for specific user', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success', { userId: 'user123' });
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success', { userId: 'user456' });
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success', { userId: 'user123' });

      const entries = logger.getUserEntries('user123');
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.userId === 'user123')).toBe(true);
    });
  });

  describe('getActionEntries', () => {
    it('should return entries for specific action', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await logger.log(SecurityEventType.TOKEN_EXPIRED, 'failure');
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      const entries = logger.getActionEntries(SecurityEventType.TOKEN_VERIFIED);
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.action === SecurityEventType.TOKEN_VERIFIED)).toBe(true);
    });
  });

  describe('getFailedEntries', () => {
    it('should return failed entries', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await logger.log(SecurityEventType.TOKEN_INVALID, 'failure');
      await logger.log(SecurityEventType.TOKEN_EXPIRED, 'error');

      const entries = logger.getFailedEntries();
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.result === 'failure' || e.result === 'error')).toBe(true);
    });
  });

  describe('getEntryCount', () => {
    it('should return total entry count', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      expect(logger.getEntryCount()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      logger.clear();

      expect(logger.getEntryCount()).toBe(0);
    });
  });

  describe('exportEntries', () => {
    it('should export all entries', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      const exported = logger.exportEntries();
      expect(exported).toHaveLength(2);
    });

    it('should return a copy of entries', async () => {
      await logger.log(SecurityEventType.TOKEN_VERIFIED, 'success');

      const exported = logger.exportEntries();
      exported.pop();

      expect(logger.getEntryCount()).toBe(1);
    });
  });
});
