/**
 * Test utilities and mocks for Vikunja tools
 */
import { vi } from 'vitest';
import { SecurityContext } from '@mcp-gateway/server';
import type { AuthContext } from '@mcp-gateway/core';
import { VikunjaClient } from '../src/vikunja-client.js';

/**
 * Create a mock VikunjaClient for testing
 */
export function createMockClient(): VikunjaClient {
  const client = new VikunjaClient('http://test.vikunja.io');
  client.setToken('test-token');
  return client;
}

/**
 * Create a mock SecurityContext for testing
 */
export function createMockSecurityContext(scopes: string[] = ['vikunja:read', 'vikunja:write']): SecurityContext {
  const authContext: AuthContext = {
    userId: 'test-user-123',
    scope: scopes,
    metadata: {
      username: 'testuser',
      email: 'test@example.com',
    },
  };

  return {
    auth: authContext,
    validateScopes: (required: string[]): boolean => {
      return required.every((scope) => authContext.scope.includes(scope));
    },
    hasScope: (scope: string): boolean => {
      return authContext.scope.includes(scope);
    },
    getUserId: (): string => authContext.userId,
  };
}

/**
 * Mock data generators
 */
export const mockData = {
  user: (overrides = {}) => ({
    id: 1,
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  }),

  project: (overrides = {}) => ({
    id: 1,
    title: 'Test Project',
    description: 'A test project',
    identifier: 'TEST',
    hex_color: '#1973ff',
    is_archived: false,
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    owner: mockData.user(),
    views: [],
    ...overrides,
  }),

  task: (overrides = {}) => ({
    id: 1,
    title: 'Test Task',
    description: 'A test task description',
    done: false,
    done_at: null,
    project_id: 1,
    bucket_id: null,
    due_date: null,
    start_date: null,
    end_date: null,
    priority: 0,
    position: 0,
    percent_done: 0,
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    labels: [],
    assignees: [],
    created_by: mockData.user(),
    ...overrides,
  }),

  bucket: (overrides = {}) => ({
    id: 1,
    title: 'Test Bucket',
    project_id: 1,
    view_id: 1,
    position: 0,
    limit: 0,
    count: 0,
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  comment: (overrides = {}) => ({
    id: 1,
    comment: 'Test comment',
    task_id: 1,
    author: mockData.user(),
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  view: (overrides = {}) => ({
    id: 1,
    title: 'Kanban',
    view_kind: 'kanban',
    position: 0,
    project_id: 1,
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  label: (overrides = {}) => ({
    id: 1,
    title: 'Test Label',
    hex_color: '#ff0000',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    ...overrides,
  }),
};

/**
 * Mock client methods helper
 */
export function mockClientMethods(
  client: VikunjaClient,
  methods: Record<string, (...args: any[]) => any>
): void {
  Object.entries(methods).forEach(([methodName, implementation]) => {
    (client as any)[methodName] = vi.fn(implementation);
  });
}

/**
 * Assert validation error is thrown
 */
export async function assertValidationError(
  fn: () => Promise<any>,
  expectedMessage?: string
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected validation error to be thrown');
  } catch (error: any) {
    if (!error.message.includes('validation') && !error.issues) {
      throw new Error(`Expected validation error, got: ${error.message}`);
    }
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error message to contain "${expectedMessage}", got: ${error.message}`
      );
    }
  }
}
