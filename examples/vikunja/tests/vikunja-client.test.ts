/**
 * Tests for VikunjaClient
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VikunjaClient } from '../src/vikunja-client.js';

describe('VikunjaClient', () => {
  let client: VikunjaClient;
  let fetchMock: any;

  beforeEach(() => {
    client = new VikunjaClient('http://test.vikunja.io');
    client.setToken('test-token');
    
    global.fetch = vi.fn();
    fetchMock = global.fetch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use provided base URL', () => {
      const customClient = new VikunjaClient('http://custom.url');
      expect(customClient).toBeDefined();
    });

    it('should use environment variable if no URL provided', () => {
      process.env.VIKUNJA_URL = 'http://env.vikunja.io';
      const envClient = new VikunjaClient();
      expect(envClient).toBeDefined();
    });

    it('should use default URL if no URL or env var', () => {
      delete process.env.VIKUNJA_URL;
      const defaultClient = new VikunjaClient();
      expect(defaultClient).toBeDefined();
    });
  });

  describe('authentication', () => {
    it('should throw error if not authenticated', async () => {
      const unauthClient = new VikunjaClient('http://test.vikunja.io');
      await expect(unauthClient.listProjects()).rejects.toThrow('not authenticated');
    });

    it('should set token', () => {
      const newClient = new VikunjaClient('http://test.vikunja.io');
      newClient.setToken('new-token');
      expect(newClient).toBeDefined();
    });
  });

  describe('projects API', () => {
    it('should list projects', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [{ id: 1, title: 'Project 1' }],
      });

      const projects = await client.listProjects();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
      expect(projects).toEqual([{ id: 1, title: 'Project 1' }]);
    });

    it('should list projects with pagination', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [],
      });

      await client.listProjects({ page: 2, per_page: 20 });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects?page=2&per_page=20',
        expect.any(Object)
      );
    });

    it('should list projects with search', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [],
      });

      await client.listProjects({ s: 'test' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects?s=test',
        expect.any(Object)
      );
    });

    it('should get project', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, title: 'Project' }),
      });

      const project = await client.getProject(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1',
        expect.any(Object)
      );
      expect(project.id).toBe(1);
    });

    it('should create project', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 2, title: 'New Project' }),
      });

      const project = await client.createProject({ title: 'New Project' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ title: 'New Project' }),
        })
      );
      expect(project.title).toBe('New Project');
    });

    it('should update project', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, title: 'Updated' }),
      });

      await client.updateProject(1, { title: 'Updated' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'Updated' }),
        })
      );
    });

    it('should delete project', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      await client.deleteProject(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('tasks API', () => {
    it('should list tasks', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [{ id: 1, title: 'Task 1' }],
      });

      const tasks = await client.listTasks(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1/tasks',
        expect.any(Object)
      );
      expect(tasks).toHaveLength(1);
    });

    it('should list tasks in view', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      });

      await client.listTasksInView(1, 10);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1/views/10/tasks',
        expect.any(Object)
      );
    });

    it('should list tasks in view with pagination', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      });

      await client.listTasksInView(1, 10, { page: 3, per_page: 25 });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1/views/10/tasks?page=3&per_page=25',
        expect.any(Object)
      );
    });

    it('should get task', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, title: 'Task' }),
      });

      const task = await client.getTask(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1',
        expect.any(Object)
      );
      expect(task.id).toBe(1);
    });

    it('should create task', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 2, title: 'New Task' }),
      });

      const task = await client.createTask(1, { title: 'New Task' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1/tasks',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ title: 'New Task' }),
        })
      );
      expect(task.title).toBe('New Task');
    });

    it('should update task', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, done: true }),
      });

      await client.updateTask(1, { done: true });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ done: true }),
        })
      );
    });

    it('should delete task', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      await client.deleteTask(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('comments API', () => {
    it('should list task comments', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [{ id: 1, comment: 'Comment' }],
      });

      const comments = await client.listTaskComments(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1/comments',
        expect.any(Object)
      );
      expect(comments).toHaveLength(1);
    });

    it('should list task comments with pagination', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [],
      });

      await client.listTaskComments(1, { page: 2, per_page: 10 });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1/comments?page=2&per_page=10',
        expect.any(Object)
      );
    });

    it('should add task comment', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 2, comment: 'New comment' }),
      });

      const comment = await client.addTaskComment(1, 'New comment');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1/comments',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ comment: 'New comment' }),
        })
      );
      expect(comment.comment).toBe('New comment');
    });

    it('should update comment', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, comment: 'Updated' }),
      });

      await client.updateComment(1, 1, 'Updated');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1/comments/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ comment: 'Updated' }),
        })
      );
    });

    it('should delete comment', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      await client.deleteComment(1, 1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1/comments/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('buckets API', () => {
    it('should list buckets', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [{ id: 1, title: 'Bucket' }],
      });

      const buckets = await client.listBuckets(1, 10);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1/views/10/buckets',
        expect.any(Object)
      );
      expect(buckets).toHaveLength(1);
    });

    it('should list buckets with pagination', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [],
      });

      await client.listBuckets(1, 10, { page: 2, per_page: 15 });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1/views/10/buckets?page=2&per_page=15',
        expect.any(Object)
      );
    });

    it('should create bucket', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 2, title: 'New Bucket' }),
      });

      const bucket = await client.createBucket(1, 10, { title: 'New Bucket' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/projects/1/views/10/buckets',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ title: 'New Bucket' }),
        })
      );
      expect(bucket.title).toBe('New Bucket');
    });

    it('should update bucket', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, title: 'Updated' }),
      });

      await client.updateBucket(1, { title: 'Updated' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/buckets/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'Updated' }),
        })
      );
    });

    it('should delete bucket', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      await client.deleteBucket(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/buckets/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('views API', () => {
    it('should get kanban view', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          id: 1,
          views: [
            { id: 5, view_kind: 'list' },
            { id: 10, view_kind: 'kanban' },
          ],
        }),
      });

      const viewId = await client.getKanbanView(1);

      expect(viewId).toBe(10);
    });

    it('should return null if no kanban view', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          id: 1,
          views: [{ id: 5, view_kind: 'list' }],
        }),
      });

      const viewId = await client.getKanbanView(1);

      expect(viewId).toBeNull();
    });
  });

  describe('workflow helpers', () => {
    it('should mark task done', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, done: true }),
      });

      await client.markTaskDone(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ done: true }),
        })
      );
    });

    it('should mark task undone', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, done: false }),
      });

      await client.markTaskUndone(1);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ done: false }),
        })
      );
    });

    it('should move task to bucket', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, bucket_id: 5 }),
      });

      await client.moveToBucket(1, 5);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test.vikunja.io/api/v1/tasks/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ bucket_id: 5 }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw error on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      });

      await expect(client.listProjects()).rejects.toThrow('Vikunja API error: 404 - Not found');
    });

    it('should handle empty responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      await client.deleteProject(1);

      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
