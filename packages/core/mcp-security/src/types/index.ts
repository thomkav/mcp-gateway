import { z } from 'zod';

/**
 * Authentication token payload
 */
export const TokenPayloadSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  scope: z.array(z.string()),
  iat: z.number(),
  exp: z.number(),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

/**
 * Session data structure
 */
export const SessionDataSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
  createdAt: z.date(),
  expiresAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

export type SessionData = z.infer<typeof SessionDataSchema>;

/**
 * Audit log entry
 */
export const AuditLogEntrySchema = z.object({
  timestamp: z.date(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  action: z.string(),
  resource: z.string().optional(),
  result: z.enum(['success', 'failure', 'error']),
  metadata: z.record(z.unknown()).optional(),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

/**
 * Rate limit configuration
 */
export const RateLimitConfigSchema = z.object({
  windowMs: z.number().positive(),
  maxRequests: z.number().positive(),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/**
 * Token verification result
 */
export interface TokenVerificationResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

/**
 * Session verification result
 */
export interface SessionVerificationResult {
  valid: boolean;
  session?: SessionData;
  error?: string;
}

/**
 * Authorization context
 */
export interface AuthContext {
  userId: string;
  sessionId: string;
  scope: string[];
}

/**
 * Security event types
 */
export enum SecurityEventType {
  TOKEN_ISSUED = 'token_issued',
  TOKEN_VERIFIED = 'token_verified',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  SESSION_CREATED = 'session_created',
  SESSION_VERIFIED = 'session_verified',
  SESSION_EXPIRED = 'session_expired',
  SESSION_DESTROYED = 'session_destroyed',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  AUTHORIZATION_FAILED = 'authorization_failed',
  AUTHORIZATION_SUCCEEDED = 'authorization_succeeded',
}
