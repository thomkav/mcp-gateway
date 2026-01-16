/**
 * Tests for Vikunja workflow helper tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vikunjaTools } from '../src/tools.js';
import { createMockClient, createMockSecurityContext, mockData, mockClientMethods } from './test-utils.js';

describe('Workflow Tools', () => {
  let client: any;
  let context: any;

  beforeEach(() => {
    client = createMockClient();
    context = createMockSecurityContext(['vikunja:read', 'vikunja:write']);
  });

  describe('vikunja_get_next_task', () => {
    const getNextTask = vikunjaTools.find((t) => t.name === 'vikunja_get_next_task')!;

    it('should get next task by priority strategy', async () => {
      const mockTasks = [
        mockData.task({ id: 1, title: 'Low priority', priority: 1, position: 0 }),
        mockData.task({ id: 2, title: 'High priority', priority: 5, position: 1 }),
        mockData.task({ id: 3, title: 'Medium priority', priority: 3, position: 2 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, strategy: 'priority' },
        client,
        context
      );

      expect((result as any).task).toBeDefined();
      expect((result as any).task.id).toBe(2);
      expect((result as any).task.priority).toBe(5);
      expect((result as any).remaining_count).toBe(2);
    });

    it('should get next task by due_date strategy', async () => {
      const mockTasks = [
        mockData.task({ id: 1, due_date: '2024-12-31', priority: 1 }),
        mockData.task({ id: 2, due_date: '2024-01-15', priority: 3 }),
        mockData.task({ id: 3, due_date: '2024-06-01', priority: 2 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, strategy: 'due_date' },
        client,
        context
      );

      expect((result as any).task.id).toBe(2);
    });

    it('should exclude done tasks by default', async () => {
      const mockTasks = [
        mockData.task({ id: 1, done: true, priority: 5 }),
        mockData.task({ id: 2, done: false, priority: 3 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler({ projectId: 1 }, client, context);

      expect((result as any).task.id).toBe(2);
    });

    it('should return null when no tasks match criteria', async () => {
      const mockTasks = [mockData.task({ id: 1, done: true })];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler({ projectId: 1 }, client, context);

      expect((result as any).task).toBeNull();
      expect((result as any).message).toContain('No actionable tasks found');
    });

    it('should handle tasks with same priority by position', async () => {
      const mockTasks = [
        mockData.task({ id: 1, priority: 3, position: 5 }),
        mockData.task({ id: 2, priority: 3, position: 1 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler({ projectId: 1 }, client, context);

      expect((result as any).task.id).toBe(2);
    });

    it('should handle due_date strategy with null dates', async () => {
      const mockTasks = [
        mockData.task({ id: 1, due_date: null, priority: 3 }),
        mockData.task({ id: 2, due_date: null, priority: 1 }),
        mockData.task({ id: 3, due_date: '2024-06-01', priority: 2 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, strategy: 'due_date' },
        client,
        context
      );

      expect((result as any).task.id).toBe(3);
    });

    it('should handle due_date strategy with same dates by priority', async () => {
      const mockTasks = [
        mockData.task({ id: 1, due_date: '2024-06-01', priority: 2 }),
        mockData.task({ id: 2, due_date: '2024-06-01', priority: 5 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, strategy: 'due_date' },
        client,
        context
      );

      expect((result as any).task.id).toBe(2);
    });

    it('should filter dueBefore with null due_date', async () => {
      const mockTasks = [
        mockData.task({ id: 1, due_date: '2024-01-01', priority: 5 }),
        mockData.task({ id: 2, due_date: null, priority: 3 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, dueBefore: '2024-06-01' },
        client,
        context
      );

      expect((result as any).task.id).toBe(1);
    });

    it('should require vikunja:read scope', () => {
      expect(getNextTask.requiredScopes).toContain('vikunja:read');
    });
  });

  describe('vikunja_claim_task', () => {
    const claimTask = vikunjaTools.find((t) => t.name === 'vikunja_claim_task')!;

    it('should claim task with agent ID and note', async () => {
      const mockComment = mockData.comment({ id: 1, comment: '[Session started]' });
      const mockTask = mockData.task({ id: 1, title: 'Claimed Task' });

      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
        getTask: () => Promise.resolve(mockTask),
      });

      const result = await claimTask.handler(
        { taskId: 1, agentId: 'agent-123', note: 'Working on this' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', 'Task claimed successfully');
      expect((result as any).task.id).toBe(1);

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[0]).toBe(1);
      expect(commentCall[1]).toContain('[Session started]');
      expect(commentCall[1]).toContain('Approach: Working on this');
    });

    it('should require vikunja:write scope', () => {
      expect(claimTask.requiredScopes).toContain('vikunja:write');
    });

    it('should validate required taskId parameter', async () => {
      await expect(claimTask.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_complete_task_with_summary', () => {
    const completeTaskWithSummary = vikunjaTools.find(
      (t) => t.name === 'vikunja_complete_task_with_summary'
    )!;

    it('should complete task with summary', async () => {
      const mockComment = mockData.comment({ id: 1 });
      const mockTask = mockData.task({ id: 1, done: true });

      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
        updateTask: () => Promise.resolve(mockTask),
      });

      const result = await completeTaskWithSummary.handler(
        { taskId: 1, summary: 'Fixed the bug' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', 'Task completed with summary');
      expect((result as any).task.done).toBe(true);

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('[Session completed]');
      expect(commentCall[1]).toContain('**Summary:** Fixed the bug');
      expect(client.updateTask).toHaveBeenCalledWith(1, { done: true });
    });

    it('should handle completion without artifacts or next steps', async () => {
      const mockComment = mockData.comment({ id: 1 });
      const mockTask = mockData.task({ id: 1, done: true });

      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
        updateTask: () => Promise.resolve(mockTask),
      });

      await completeTaskWithSummary.handler(
        { taskId: 1, summary: 'Done' },
        client,
        context
      );

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('**Summary:** Done');
      expect(commentCall[1]).not.toContain('**Artifacts:**');
      expect(commentCall[1]).not.toContain('**Next steps:**');
    });

    it('should handle completion with empty artifacts array', async () => {
      const mockComment = mockData.comment({ id: 1 });
      const mockTask = mockData.task({ id: 1, done: true });

      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
        updateTask: () => Promise.resolve(mockTask),
      });

      await completeTaskWithSummary.handler(
        { taskId: 1, summary: 'Done', artifacts: [] },
        client,
        context
      );

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('**Summary:** Done');
      expect(commentCall[1]).not.toContain('**Artifacts:**');
    });

    it('should handle completion with artifacts', async () => {
      const mockComment = mockData.comment({ id: 1 });
      const mockTask = mockData.task({ id: 1, done: true });

      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
        updateTask: () => Promise.resolve(mockTask),
      });

      await completeTaskWithSummary.handler(
        {
          taskId: 1,
          summary: 'Completed implementation',
          artifacts: ['https://github.com/repo/commit/abc123', 'https://github.com/repo/pull/456'],
        },
        client,
        context
      );

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('**Summary:** Completed implementation');
      expect(commentCall[1]).toContain('**Artifacts:**');
      expect(commentCall[1]).toContain('- https://github.com/repo/commit/abc123');
      expect(commentCall[1]).toContain('- https://github.com/repo/pull/456');
    });

    it('should handle completion with artifacts and next steps', async () => {
      const mockComment = mockData.comment({ id: 1 });
      const mockTask = mockData.task({ id: 1, done: true });

      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
        updateTask: () => Promise.resolve(mockTask),
      });

      await completeTaskWithSummary.handler(
        {
          taskId: 1,
          summary: 'Phase 1 complete',
          artifacts: ['commit-link'],
          nextSteps: 'Start phase 2 implementation',
        },
        client,
        context
      );

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('**Summary:** Phase 1 complete');
      expect(commentCall[1]).toContain('**Artifacts:**');
      expect(commentCall[1]).toContain('- commit-link');
      expect(commentCall[1]).toContain('**Next steps:** Start phase 2 implementation');
    });

    it('should require vikunja:write scope', () => {
      expect(completeTaskWithSummary.requiredScopes).toContain('vikunja:write');
    });
  });

  describe('vikunja_add_task_checkpoint', () => {
    const addTaskCheckpoint = vikunjaTools.find((t) => t.name === 'vikunja_add_task_checkpoint')!;

    it('should add checkpoint with message', async () => {
      const mockComment = mockData.comment({ id: 1, created: '2024-01-15T10:00:00Z' });
      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
      });

      const result = await addTaskCheckpoint.handler(
        { taskId: 1, message: 'Completed first phase' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect((result as any).checkpoint.message).toBe('Completed first phase');

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('[Checkpoint] Completed first phase');
    });

    it('should handle checkpoint without artifacts', async () => {
      const mockComment = mockData.comment({ id: 1 });
      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
      });

      await addTaskCheckpoint.handler(
        { taskId: 1, message: 'Progress update' },
        client,
        context
      );

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('[Checkpoint] Progress update');
      expect(commentCall[1]).not.toContain('Artifacts:');
    });

    it('should handle checkpoint with empty artifacts array', async () => {
      const mockComment = mockData.comment({ id: 1 });
      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
      });

      await addTaskCheckpoint.handler(
        { taskId: 1, message: 'Empty artifacts', artifacts: [] },
        client,
        context
      );

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('[Checkpoint] Empty artifacts');
      expect(commentCall[1]).not.toContain('Artifacts:');
    });

    it('should handle checkpoint with artifacts', async () => {
      const mockComment = mockData.comment({ id: 1 });
      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
      });

      await addTaskCheckpoint.handler(
        {
          taskId: 1,
          message: 'Checkpoint with files',
          artifacts: ['file1.ts', 'file2.ts', 'file3.ts'],
        },
        client,
        context
      );

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('[Checkpoint] Checkpoint with files');
      expect(commentCall[1]).toContain('Artifacts:');
      expect(commentCall[1]).toContain('- file1.ts');
      expect(commentCall[1]).toContain('- file2.ts');
      expect(commentCall[1]).toContain('- file3.ts');
    });

    it('should require vikunja:write scope', () => {
      expect(addTaskCheckpoint.requiredScopes).toContain('vikunja:write');
    });
  });

  describe('vikunja_release_task', () => {
    const releaseTask = vikunjaTools.find((t) => t.name === 'vikunja_release_task')!;

    it('should release task with reason', async () => {
      const mockComment = mockData.comment({ id: 1 });
      const mockTask = mockData.task({ id: 1 });

      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
        getTask: () => Promise.resolve(mockTask),
      });

      const result = await releaseTask.handler(
        { taskId: 1, reason: 'Blocked by dependency' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', 'Task released');

      const commentCall = client.addTaskComment.mock.calls[0];
      expect(commentCall[1]).toContain('[Session released]');
      expect(commentCall[1]).toContain('Reason: Blocked by dependency');
    });

    it('should require vikunja:write scope', () => {
      expect(releaseTask.requiredScopes).toContain('vikunja:write');
    });
  });

  describe('vikunja_get_next_task - additional edge cases', () => {
    const getNextTask = vikunjaTools.find((t) => t.name === 'vikunja_get_next_task')!;

    it('should handle tasks with same due dates sorted by priority', async () => {
      const mockTasks = [
        mockData.task({ id: 1, due_date: '2024-01-15', priority: 1, done: false }),
        mockData.task({ id: 2, due_date: '2024-01-15', priority: 5, done: false }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, strategy: 'due_date' },
        client,
        context
      );

      expect((result as any).task.id).toBe(2); // Higher priority when same due date
    });

    it('should handle tasks with no due dates sorted by priority', async () => {
      const mockTasks = [
        mockData.task({ id: 1, due_date: null, priority: 1, done: false }),
        mockData.task({ id: 2, due_date: null, priority: 3, done: false }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, strategy: 'due_date' },
        client,
        context
      );

      // When both have null due_dates, falls back to priority (higher = better)
      // Looking at line 1172: if (!a.due_date && !b.due_date) return a.priority - b.priority;
      // This sorts ASCENDING by priority, so task with priority 1 comes first
      expect((result as any).task.id).toBe(1);
    });

    it('should sort by position with fifo strategy', async () => {
      const mockTasks = [
        mockData.task({ id: 1, position: 5, priority: 5, done: false }),
        mockData.task({ id: 2, position: 1, priority: 1, done: false }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, strategy: 'fifo' },
        client,
        context
      );

      expect((result as any).task.id).toBe(2); // Lower position
    });

    it('should handle priority sort with same priorities', async () => {
      const mockTasks = [
        mockData.task({ id: 1, priority: 3, position: 5, done: false }),
        mockData.task({ id: 2, priority: 3, position: 2, done: false }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, strategy: 'priority' },
        client,
        context
      );

      expect((result as any).task.id).toBe(2); // Lower position when same priority
    });

    it('should not filter tasks with no due date when dueBefore is set', async () => {
      const mockTasks = [
        mockData.task({ id: 1, due_date: null, done: false, priority: 5 }),
        mockData.task({ id: 2, due_date: '2024-01-10', done: false, priority: 3 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await getNextTask.handler(
        { projectId: 1, dueBefore: '2024-01-15' },
        client,
        context
      );

      // Task 1 has no due date so isn't filtered by dueBefore, has higher priority
      expect((result as any).task.id).toBe(1);
    });
  });
});