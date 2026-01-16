/**
 * Tests for Vikunja bucket tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vikunjaTools } from '../src/tools.js';
import { createMockClient, createMockSecurityContext, mockData, mockClientMethods } from './test-utils.js';

describe('Bucket Tools', () => {
  let client: any;
  let context: any;

  beforeEach(() => {
    client = createMockClient();
    context = createMockSecurityContext(['vikunja:read', 'vikunja:write', 'vikunja:delete']);
  });

  describe('vikunja_list_buckets', () => {
    const listBuckets = vikunjaTools.find((t) => t.name === 'vikunja_list_buckets')!;

    it('should list buckets with default pagination', async () => {
      const mockBuckets = [
        mockData.bucket({ id: 1, title: 'To Do' }),
        mockData.bucket({ id: 2, title: 'In Progress' }),
        mockData.bucket({ id: 3, title: 'Done' }),
      ];
      mockClientMethods(client, {
        listBuckets: () => Promise.resolve(mockBuckets),
      });

      const result = await listBuckets.handler(
        { projectId: 1, viewId: 10 },
        client,
        context
      );

      expect(result).toHaveProperty('buckets');
      expect((result as any).buckets).toHaveLength(3);
      expect(result).toHaveProperty('count', 3);
      expect(result).toHaveProperty('pagination');
      expect(client.listBuckets).toHaveBeenCalledWith(1, 10, { page: 1, per_page: 50 });
    });

    it('should list buckets with custom pagination', async () => {
      const mockBuckets = Array.from({ length: 20 }, (_, i) =>
        mockData.bucket({ id: i + 1, title: `Bucket ${i + 1}` })
      );
      mockClientMethods(client, {
        listBuckets: () => Promise.resolve(mockBuckets),
      });

      const result = await listBuckets.handler(
        { projectId: 1, viewId: 10, page: 2, per_page: 20 },
        client,
        context
      );

      expect((result as any).count).toBe(20);
      expect(client.listBuckets).toHaveBeenCalledWith(1, 10, { page: 2, per_page: 20 });
    });

    it('should respect max per_page of 100', async () => {
      mockClientMethods(client, {
        listBuckets: () => Promise.resolve([]),
      });

      await listBuckets.handler(
        { projectId: 1, viewId: 10, per_page: 200 },
        client,
        context
      );

      expect(client.listBuckets).toHaveBeenCalledWith(1, 10, { page: 1, per_page: 100 });
    });

    it('should include bucket metadata', async () => {
      const mockBuckets = [
        mockData.bucket({
          id: 1,
          title: 'To Do',
          position: 0,
          limit: 10,
          count: 5,
          created: '2024-01-01',
          updated: '2024-01-15',
        }),
      ];
      mockClientMethods(client, {
        listBuckets: () => Promise.resolve(mockBuckets),
      });

      const result = await listBuckets.handler(
        { projectId: 1, viewId: 10 },
        client,
        context
      );

      const bucket = (result as any).buckets[0];
      expect(bucket).toHaveProperty('id', 1);
      expect(bucket).toHaveProperty('title', 'To Do');
      expect(bucket).toHaveProperty('position', 0);
      expect(bucket).toHaveProperty('limit', 10);
      expect(bucket).toHaveProperty('count', 5);
      expect(bucket).toHaveProperty('created');
      expect(bucket).toHaveProperty('updated');
    });

    it('should require vikunja:read scope', () => {
      expect(listBuckets.requiredScopes).toContain('vikunja:read');
    });

    it('should validate required parameters', async () => {
      await expect(listBuckets.handler({}, client, context)).rejects.toThrow();
      await expect(listBuckets.handler({ projectId: 1 }, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_create_bucket', () => {
    const createBucket = vikunjaTools.find((t) => t.name === 'vikunja_create_bucket')!;

    it('should create bucket with minimal parameters', async () => {
      const mockBucket = mockData.bucket({ id: 5, title: 'New Bucket' });
      mockClientMethods(client, {
        createBucket: () => Promise.resolve(mockBucket),
      });

      const result = await createBucket.handler(
        { projectId: 1, viewId: 10, title: 'New Bucket' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect((result as any).bucket.title).toBe('New Bucket');
      expect(client.createBucket).toHaveBeenCalledWith(1, 10, { title: 'New Bucket' });
    });

    it('should create bucket with position', async () => {
      const mockBucket = mockData.bucket({ id: 5, title: 'New Bucket', position: 3 });
      mockClientMethods(client, {
        createBucket: () => Promise.resolve(mockBucket),
      });

      const result = await createBucket.handler(
        { projectId: 1, viewId: 10, title: 'New Bucket', position: 3 },
        client,
        context
      );

      expect(client.createBucket).toHaveBeenCalledWith(1, 10, {
        title: 'New Bucket',
        position: 3,
      });
    });

    it('should require vikunja:write scope', () => {
      expect(createBucket.requiredScopes).toContain('vikunja:write');
    });

    it('should validate required parameters', async () => {
      await expect(createBucket.handler({}, client, context)).rejects.toThrow();
      await expect(createBucket.handler({ projectId: 1 }, client, context)).rejects.toThrow();
      await expect(
        createBucket.handler({ projectId: 1, viewId: 10 }, client, context)
      ).rejects.toThrow();
    });
  });

  describe('vikunja_update_bucket', () => {
    const updateBucket = vikunjaTools.find((t) => t.name === 'vikunja_update_bucket')!;

    it('should update bucket title', async () => {
      const mockBucket = mockData.bucket({ id: 1, title: 'Updated Title' });
      mockClientMethods(client, {
        updateBucket: () => Promise.resolve(mockBucket),
      });

      const result = await updateBucket.handler(
        { bucketId: 1, title: 'Updated Title' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect((result as any).bucket.title).toBe('Updated Title');
      expect(client.updateBucket).toHaveBeenCalledWith(1, { title: 'Updated Title' });
    });

    it('should update bucket position', async () => {
      const mockBucket = mockData.bucket({ id: 1, position: 5 });
      mockClientMethods(client, {
        updateBucket: () => Promise.resolve(mockBucket),
      });

      await updateBucket.handler({ bucketId: 1, position: 5 }, client, context);

      expect(client.updateBucket).toHaveBeenCalledWith(1, { position: 5 });
    });

    it('should update bucket limit', async () => {
      const mockBucket = mockData.bucket({ id: 1, limit: 20 });
      mockClientMethods(client, {
        updateBucket: () => Promise.resolve(mockBucket),
      });

      await updateBucket.handler({ bucketId: 1, limit: 20 }, client, context);

      expect(client.updateBucket).toHaveBeenCalledWith(1, { limit: 20 });
    });

    it('should update multiple fields', async () => {
      const mockBucket = mockData.bucket({
        id: 1,
        title: 'Updated',
        position: 3,
        limit: 15,
      });

      mockClientMethods(client, {
        updateBucket: () => Promise.resolve(mockBucket),
      });

      await updateBucket.handler(
        {
          bucketId: 1,
          title: 'Updated',
          position: 3,
          limit: 15,
        },
        client,
        context
      );

      expect(client.updateBucket).toHaveBeenCalledWith(1, {
        title: 'Updated',
        position: 3,
        limit: 15,
      });
    });

    it('should require vikunja:write scope', () => {
      expect(updateBucket.requiredScopes).toContain('vikunja:write');
    });

    it('should validate required bucketId parameter', async () => {
      await expect(updateBucket.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_delete_bucket', () => {
    const deleteBucket = vikunjaTools.find((t) => t.name === 'vikunja_delete_bucket')!;

    it('should delete bucket successfully', async () => {
      mockClientMethods(client, {
        deleteBucket: () => Promise.resolve(),
      });

      const result = await deleteBucket.handler({ bucketId: 1 }, client, context);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect((result as any).message).toContain('Bucket 1 deleted');
      expect(client.deleteBucket).toHaveBeenCalledWith(1);
    });

    it('should require vikunja:delete scope', () => {
      expect(deleteBucket.requiredScopes).toContain('vikunja:delete');
      expect(deleteBucket.requiredScopes).toContain('vikunja:write');
    });

    it('should have custom auth check for delete scope', () => {
      expect(deleteBucket.customAuthCheck).toBeDefined();

      const authContext = { scope: ['vikunja:delete'], userId: 'test', metadata: {} };
      expect(deleteBucket.customAuthCheck!(authContext)).toBe(true);

      const authContextNoDelete = { scope: ['vikunja:write'], userId: 'test', metadata: {} };
      expect(deleteBucket.customAuthCheck!(authContextNoDelete)).toBe(false);
    });

    it('should validate required bucketId parameter', async () => {
      await expect(deleteBucket.handler({}, client, context)).rejects.toThrow();
    });
  });
});
