/**
 * Tests for Vikunja project tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vikunjaTools } from '../src/tools.js';
import { createMockClient, createMockSecurityContext, mockData, mockClientMethods } from './test-utils.js';

describe('Project Tools', () => {
  let client: any;
  let context: any;

  beforeEach(() => {
    client = createMockClient();
    context = createMockSecurityContext(['vikunja:read', 'vikunja:write', 'vikunja:delete']);
  });

  describe('vikunja_list_projects', () => {
    const listProjects = vikunjaTools.find((t) => t.name === 'vikunja_list_projects')!;

    it('should list projects with default pagination', async () => {
      const mockProjects = [mockData.project({ id: 1 }), mockData.project({ id: 2 })];
      mockClientMethods(client, {
        listProjects: () => Promise.resolve(mockProjects),
      });

      const result = await listProjects.handler({}, client, context);

      expect(result).toHaveProperty('projects');
      expect(result).toHaveProperty('count', 2);
      expect(result).toHaveProperty('pagination');
      expect((result as any).projects).toHaveLength(2);
      expect(client.listProjects).toHaveBeenCalledWith({
        page: 1,
        per_page: 50,
      });
    });

    it('should list projects with custom pagination', async () => {
      const mockProjects = Array.from({ length: 10 }, (_, i) => mockData.project({ id: i + 1 }));
      mockClientMethods(client, {
        listProjects: () => Promise.resolve(mockProjects),
      });

      const result = await listProjects.handler(
        { page: 2, per_page: 10 },
        client,
        context
      );

      expect((result as any).count).toBe(10);
      expect(client.listProjects).toHaveBeenCalledWith({
        page: 2,
        per_page: 10,
      });
    });

    it('should respect max per_page of 100', async () => {
      mockClientMethods(client, {
        listProjects: () => Promise.resolve([]),
      });

      await listProjects.handler({ page: 1, per_page: 200 }, client, context);

      expect(client.listProjects).toHaveBeenCalledWith({
        page: 1,
        per_page: 100,
        s: undefined,
      });
    });

    it('should support search parameter', async () => {
      mockClientMethods(client, {
        listProjects: () => Promise.resolve([mockData.project({ title: 'Matching Project' })]),
      });

      const result = await listProjects.handler(
        { search: 'Matching' },
        client,
        context
      );

      expect(client.listProjects).toHaveBeenCalledWith({
        page: 1,
        per_page: 50,
        s: 'Matching',
      });
      expect((result as any).count).toBe(1);
    });

    it('should require vikunja:read scope', () => {
      expect(listProjects.requiredScopes).toContain('vikunja:read');
    });
  });

  describe('vikunja_get_project', () => {
    const getProject = vikunjaTools.find((t) => t.name === 'vikunja_get_project')!;

    it('should get project details without buckets', async () => {
      const mockProject = mockData.project({ id: 1 });
      mockClientMethods(client, {
        getProject: () => Promise.resolve(mockProject),
        getKanbanView: () => Promise.resolve(null),
      });

      const result = await getProject.handler({ projectId: 1 }, client, context);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('title', 'Test Project');
      expect(result).not.toHaveProperty('buckets');
      expect(client.getProject).toHaveBeenCalledWith(1);
    });

    it('should get project details with buckets', async () => {
      const mockProject = mockData.project({
        id: 1,
        views: [mockData.view({ id: 10, view_kind: 'kanban' })],
      });
      const mockBuckets = [mockData.bucket({ id: 1 }), mockData.bucket({ id: 2 })];

      mockClientMethods(client, {
        getProject: () => Promise.resolve(mockProject),
        getKanbanView: () => Promise.resolve(10),
        listBuckets: () => Promise.resolve(mockBuckets),
      });

      const result = await getProject.handler({ projectId: 1 }, client, context);

      expect(result).toHaveProperty('buckets');
      expect((result as any).buckets).toHaveLength(2);
      expect(client.listBuckets).toHaveBeenCalledWith(1, 10);
    });

    it('should handle bucket fetch errors gracefully', async () => {
      const mockProject = mockData.project({
        id: 1,
        views: [mockData.view({ id: 10, view_kind: 'kanban' })],
      });

      mockClientMethods(client, {
        getProject: () => Promise.resolve(mockProject),
        getKanbanView: () => Promise.resolve(10),
        listBuckets: () => Promise.reject(new Error('Bucket error')),
      });

      const result = await getProject.handler({ projectId: 1 }, client, context);

      expect(result).not.toHaveProperty('buckets');
      expect(result).toHaveProperty('id', 1);
    });

    it('should validate required projectId parameter', async () => {
      await expect(getProject.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_create_project', () => {
    const createProject = vikunjaTools.find((t) => t.name === 'vikunja_create_project')!;

    it('should create project with minimal parameters', async () => {
      const mockProject = mockData.project({ id: 5, title: 'New Project' });
      mockClientMethods(client, {
        createProject: () => Promise.resolve(mockProject),
      });

      const result = await createProject.handler({ title: 'New Project' }, client, context);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('project');
      expect((result as any).project.title).toBe('New Project');
      expect(client.createProject).toHaveBeenCalledWith({ title: 'New Project' });
    });

    it('should create project with all parameters', async () => {
      const mockProject = mockData.project({
        id: 5,
        title: 'Full Project',
        description: 'With description',
        hex_color: '#ff0000',
        is_archived: true,
      });

      mockClientMethods(client, {
        createProject: () => Promise.resolve(mockProject),
      });

      const result = await createProject.handler(
        {
          title: 'Full Project',
          description: 'With description',
          hexColor: '#ff0000',
          isArchived: true,
          parentProjectId: 10,
        },
        client,
        context
      );

      expect(client.createProject).toHaveBeenCalledWith({
        title: 'Full Project',
        description: 'With description',
        hex_color: '#ff0000',
        is_archived: true,
        parent_project_id: 10,
      });
    });

    it('should require vikunja:write scope', () => {
      expect(createProject.requiredScopes).toContain('vikunja:write');
    });

    it('should validate required title parameter', async () => {
      await expect(createProject.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_update_project', () => {
    const updateProject = vikunjaTools.find((t) => t.name === 'vikunja_update_project')!;

    it('should update project title', async () => {
      const mockProject = mockData.project({ id: 1, title: 'Updated Title' });
      mockClientMethods(client, {
        updateProject: () => Promise.resolve(mockProject),
      });

      const result = await updateProject.handler(
        { projectId: 1, title: 'Updated Title' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect((result as any).project.title).toBe('Updated Title');
      expect(client.updateProject).toHaveBeenCalledWith(1, { title: 'Updated Title' });
    });

    it('should update multiple fields', async () => {
      const mockProject = mockData.project({
        id: 1,
        title: 'Updated',
        description: 'New description',
        is_archived: true,
      });

      mockClientMethods(client, {
        updateProject: () => Promise.resolve(mockProject),
      });

      await updateProject.handler(
        {
          projectId: 1,
          title: 'Updated',
          description: 'New description',
          isArchived: true,
        },
        client,
        context
      );

      expect(client.updateProject).toHaveBeenCalledWith(1, {
        title: 'Updated',
        description: 'New description',
        is_archived: true,
      });
    });

    it('should validate required projectId parameter', async () => {
      await expect(updateProject.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_delete_project', () => {
    const deleteProject = vikunjaTools.find((t) => t.name === 'vikunja_delete_project')!;

    it('should delete project successfully', async () => {
      mockClientMethods(client, {
        deleteProject: () => Promise.resolve(),
      });

      const result = await deleteProject.handler({ projectId: 1 }, client, context);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect(client.deleteProject).toHaveBeenCalledWith(1);
    });

    it('should require vikunja:delete scope', () => {
      expect(deleteProject.requiredScopes).toContain('vikunja:delete');
      expect(deleteProject.requiredScopes).toContain('vikunja:write');
    });

    it('should have custom auth check for delete scope', () => {
      expect(deleteProject.customAuthCheck).toBeDefined();

      const authContext = { scope: ['vikunja:delete'], userId: 'test', metadata: {} };
      expect(deleteProject.customAuthCheck!(authContext)).toBe(true);

      const authContextNoDelete = { scope: ['vikunja:write'], userId: 'test', metadata: {} };
      expect(deleteProject.customAuthCheck!(authContextNoDelete)).toBe(false);
    });

    it('should validate required projectId parameter', async () => {
      await expect(deleteProject.handler({}, client, context)).rejects.toThrow();
    });
  });
});
