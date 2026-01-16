/**
 * Tests for Vikunja task tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vikunjaTools } from '../src/tools.js';
import { createMockClient, createMockSecurityContext, mockData, mockClientMethods } from './test-utils.js';

describe('Task Tools', () => {
  let client: any;
  let context: any;

  beforeEach(() => {
    client = createMockClient();
    context = createMockSecurityContext(['vikunja:read', 'vikunja:write', 'vikunja:delete']);
  });

  describe('vikunja_list_tasks', () => {
    const listTasks = vikunjaTools.find((t) => t.name === 'vikunja_list_tasks')!;

    it('should list tasks with default parameters', async () => {
      const mockTasks = [
        mockData.task({ id: 1, title: 'Task 1' }),
        mockData.task({ id: 2, title: 'Task 2' }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler({ projectId: 1 }, client, context);

      expect(result).toHaveProperty('tasks');
      expect((result as any).tasks).toHaveLength(2);
      expect((result as any).tasks[0]).toHaveProperty('id');
      expect((result as any).tasks[0]).toHaveProperty('title');
      expect((result as any).tasks[0]).toHaveProperty('description');
      expect(client.listTasks).toHaveBeenCalledWith(1, { page: 1, per_page: 50 });
    });

    it('should truncate descriptions by default', async () => {
      const longDescription = 'a'.repeat(1000);
      const mockTasks = [mockData.task({ id: 1, description: longDescription })];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler({ projectId: 1 }, client, context);

      expect((result as any).tasks[0].description.length).toBeLessThan(longDescription.length);
      expect((result as any).tasks[0].description).toContain('... [truncated]');
    });

    it('should include full description when requested', async () => {
      const longDescription = 'a'.repeat(1000);
      const mockTasks = [mockData.task({ id: 1, description: longDescription })];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        { projectId: 1, includeFullDescription: true },
        client,
        context
      );

      expect((result as any).tasks[0].description).toBe(longDescription);
    });

    it('should list tasks in a view', async () => {
      const mockTasks = { 1: [mockData.task({ id: 1, bucket_id: 1 })] };
      mockClientMethods(client, {
        listTasksInView: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        { projectId: 1, viewId: 10 },
        client,
        context
      );

      expect(client.listTasksInView).toHaveBeenCalledWith(1, 10, { page: 1, per_page: 50 });
      expect((result as any).tasks).toHaveLength(1);
    });

    it('should filter tasks by bucket', async () => {
      const mockTasks = [
        mockData.task({ id: 1, bucket_id: 1 }),
        mockData.task({ id: 2, bucket_id: 2 }),
        mockData.task({ id: 3, bucket_id: 1 }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        { projectId: 1, bucketId: 1, fields: ['id', 'bucket_id'] },
        client,
        context
      );

      expect((result as any).tasks).toHaveLength(2);
      expect((result as any).tasks.every((t: any) => t.bucket_id === 1)).toBe(true);
    });

    it('should support custom field selection', async () => {
      const mockTasks = [mockData.task({ id: 1, priority: 5, created: '2024-01-01' })];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        { projectId: 1, fields: ['id', 'title', 'priority'] },
        client,
        context
      );

      const task = (result as any).tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('priority');
      expect(task).not.toHaveProperty('description');
      expect(task).not.toHaveProperty('created');
    });

    it('should auto-include id when not in requested fields', async () => {
      const mockTasks = [mockData.task({ id: 1 })];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        { projectId: 1, fields: ['title', 'priority'] },
        client,
        context
      );

      const task = (result as any).tasks[0];
      expect(task).toHaveProperty('id', 1);
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('priority');
    });

    it('should support summary output mode', async () => {
      const mockTasks = [mockData.task({ id: 1 })];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        { projectId: 1, output_mode: 'summary' },
        client,
        context
      );

      const task = (result as any).tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('done');
      expect(task).toHaveProperty('priority');
      expect(task).not.toHaveProperty('description');
    });

    it('should include pagination when has_more', async () => {
      const mockTasks = Array.from({ length: 50 }, (_, i) => mockData.task({ id: i + 1 }));
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        { projectId: 1, per_page: 50 },
        client,
        context
      );

      expect(result).toHaveProperty('pagination');
      expect((result as any).pagination.has_more).toBe(true);
    });

    it('should not include pagination when no more results', async () => {
      const mockTasks = [mockData.task({ id: 1 })];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler({ projectId: 1 }, client, context);

      expect(result).not.toHaveProperty('pagination');
    });

    it('should include all extended fields when requested', async () => {
      const mockTasks = [
        mockData.task({
          id: 1,
          created: '2024-01-01',
          updated: '2024-01-02',
          position: 5,
          start_date: '2024-01-10',
          end_date: '2024-01-20',
          labels: [mockData.label({ id: 1, title: 'label1' })],
          assignees: [mockData.user({ id: 2, username: 'user1' })],
        }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        {
          projectId: 1,
          fields: [
            'id',
            'created',
            'updated',
            'position',
            'start_date',
            'end_date',
            'labels',
            'assignees',
          ],
        },
        client,
        context
      );

      const task = (result as any).tasks[0];
      expect(task).toHaveProperty('created', '2024-01-01');
      expect(task).toHaveProperty('updated', '2024-01-02');
      expect(task).toHaveProperty('position', 5);
      expect(task).toHaveProperty('start_date', '2024-01-10');
      expect(task).toHaveProperty('end_date', '2024-01-20');
      expect(task.labels).toHaveLength(1);
      expect(task.labels[0]).toHaveProperty('title', 'label1');
      expect(task.assignees).toHaveLength(1);
      expect(task.assignees[0]).toHaveProperty('username', 'user1');
    });
  });

  describe('vikunja_get_task', () => {
    const getTask = vikunjaTools.find((t) => t.name === 'vikunja_get_task')!;

    it('should get task details', async () => {
      const mockTask = mockData.task({ id: 1, title: 'Detailed Task' });
      mockClientMethods(client, {
        getTask: () => Promise.resolve(mockTask),
      });

      const result = await getTask.handler({ taskId: 1 }, client, context);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('title', 'Detailed Task');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('created_by');
      expect(client.getTask).toHaveBeenCalledWith(1);
    });

    it('should include labels and assignees', async () => {
      const mockTask = mockData.task({
        id: 1,
        labels: [mockData.label({ id: 1, title: 'bug' })],
        assignees: [mockData.user({ id: 2, username: 'assignee' })],
      });
      mockClientMethods(client, {
        getTask: () => Promise.resolve(mockTask),
      });

      const result = await getTask.handler({ taskId: 1 }, client, context);

      expect((result as any).labels).toHaveLength(1);
      expect((result as any).labels[0]).toHaveProperty('title', 'bug');
      expect((result as any).assignees).toHaveLength(1);
      expect((result as any).assignees[0]).toHaveProperty('username', 'assignee');
    });

    it('should validate required taskId parameter', async () => {
      await expect(getTask.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_create_task', () => {
    const createTask = vikunjaTools.find((t) => t.name === 'vikunja_create_task')!;

    it('should create task with minimal parameters', async () => {
      const mockTask = mockData.task({ id: 10, title: 'New Task' });
      mockClientMethods(client, {
        createTask: () => Promise.resolve(mockTask),
      });

      const result = await createTask.handler(
        { projectId: 1, title: 'New Task' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect((result as any).task.title).toBe('New Task');
      expect(client.createTask).toHaveBeenCalledWith(1, { title: 'New Task' });
    });

    it('should create task with all parameters', async () => {
      const mockTask = mockData.task({
        id: 10,
        title: 'Full Task',
        description: 'With details',
        bucket_id: 5,
        due_date: '2024-12-31',
        priority: 3,
      });

      mockClientMethods(client, {
        createTask: () => Promise.resolve(mockTask),
      });

      const result = await createTask.handler(
        {
          projectId: 1,
          title: 'Full Task',
          description: 'With details',
          bucketId: 5,
          dueDate: '2024-12-31',
          priority: 3,
        },
        client,
        context
      );

      expect(client.createTask).toHaveBeenCalledWith(1, {
        title: 'Full Task',
        description: 'With details',
        bucket_id: 5,
        due_date: '2024-12-31',
        priority: 3,
      });
    });

    it('should require vikunja:write scope', () => {
      expect(createTask.requiredScopes).toContain('vikunja:write');
    });

    it('should validate required parameters', async () => {
      await expect(createTask.handler({}, client, context)).rejects.toThrow();
      await expect(createTask.handler({ projectId: 1 }, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_update_task', () => {
    const updateTask = vikunjaTools.find((t) => t.name === 'vikunja_update_task')!;

    it('should update task and preserve existing values', async () => {
      const existingTask = mockData.task({
        id: 1,
        title: 'Old Title',
        description: 'Old description',
        done: false,
        priority: 0,
      });
      const updatedTask = { ...existingTask, title: 'New Title' };

      mockClientMethods(client, {
        getTask: () => Promise.resolve(existingTask),
        updateTask: () => Promise.resolve(updatedTask),
      });

      const result = await updateTask.handler(
        { taskId: 1, title: 'New Title' },
        client,
        context
      );

      expect(client.getTask).toHaveBeenCalledWith(1);
      expect(client.updateTask).toHaveBeenCalledWith(1, {
        title: 'New Title',
        description: existingTask.description,
        done: existingTask.done,
        due_date: existingTask.due_date,
        priority: existingTask.priority,
        bucket_id: existingTask.bucket_id,
      });
    });

    it('should update multiple fields', async () => {
      const existingTask = mockData.task({ id: 1 });
      const updatedTask = {
        ...existingTask,
        title: 'Updated',
        done: true,
        priority: 5,
      };

      mockClientMethods(client, {
        getTask: () => Promise.resolve(existingTask),
        updateTask: () => Promise.resolve(updatedTask),
      });

      await updateTask.handler(
        {
          taskId: 1,
          title: 'Updated',
          done: true,
          priority: 5,
        },
        client,
        context
      );

      expect(client.updateTask).toHaveBeenCalledWith(1, expect.objectContaining({
        title: 'Updated',
        done: true,
        priority: 5,
      }));
    });

    it('should validate required taskId parameter', async () => {
      await expect(updateTask.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_delete_task', () => {
    const deleteTask = vikunjaTools.find((t) => t.name === 'vikunja_delete_task')!;

    it('should delete task successfully', async () => {
      mockClientMethods(client, {
        deleteTask: () => Promise.resolve(),
      });

      const result = await deleteTask.handler({ taskId: 1 }, client, context);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect(client.deleteTask).toHaveBeenCalledWith(1);
    });

    it('should require vikunja:delete scope', () => {
      expect(deleteTask.requiredScopes).toContain('vikunja:delete');
      expect(deleteTask.requiredScopes).toContain('vikunja:write');
    });

    it('should have custom auth check for delete scope', () => {
      expect(deleteTask.customAuthCheck).toBeDefined();

      const authContext = { scope: ['vikunja:delete'], userId: 'test', metadata: {} };
      expect(deleteTask.customAuthCheck!(authContext)).toBe(true);

      const authContextNoDelete = { scope: ['vikunja:write'], userId: 'test', metadata: {} };
      expect(deleteTask.customAuthCheck!(authContextNoDelete)).toBe(false);
    });

    it('should validate required taskId parameter', async () => {
      await expect(deleteTask.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_list_tasks - additional edge cases', () => {
    const listTasks = vikunjaTools.find((t) => t.name === 'vikunja_list_tasks')!;

    it('should include start_date and end_date when requested', async () => {
      const mockTasks = [
        mockData.task({
          id: 1,
          start_date: '2024-01-01T00:00:00Z',
          end_date: '2024-01-31T23:59:59Z',
        }),
      ];
      mockClientMethods(client, {
        listTasks: () => Promise.resolve(mockTasks),
      });

      const result = await listTasks.handler(
        { projectId: 1, fields: ['id', 'start_date', 'end_date'] },
        client,
        context
      );

      expect((result as any).tasks[0]).toHaveProperty('start_date', '2024-01-01T00:00:00Z');
      expect((result as any).tasks[0]).toHaveProperty('end_date', '2024-01-31T23:59:59Z');
    });
  });
});
