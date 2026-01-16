/**
 * Tests for Vikunja comment tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vikunjaTools } from '../src/tools.js';
import { createMockClient, createMockSecurityContext, mockData, mockClientMethods } from './test-utils.js';

describe('Comment Tools', () => {
  let client: any;
  let context: any;

  beforeEach(() => {
    client = createMockClient();
    context = createMockSecurityContext(['vikunja:read', 'vikunja:write']);
  });

  describe('vikunja_list_task_comments', () => {
    const listTaskComments = vikunjaTools.find((t) => t.name === 'vikunja_list_task_comments')!;

    it('should list task comments', async () => {
      const mockComments = [
        mockData.comment({ id: 1, comment: 'First comment' }),
        mockData.comment({ id: 2, comment: 'Second comment' }),
        mockData.comment({ id: 3, comment: 'Third comment' }),
      ];
      mockClientMethods(client, {
        listTaskComments: () => Promise.resolve(mockComments),
      });

      const result = await listTaskComments.handler({ taskId: 1 }, client, context);

      expect(result).toHaveProperty('comments');
      expect((result as any).comments).toHaveLength(3);
      expect(result).toHaveProperty('count', 3);
      expect(client.listTaskComments).toHaveBeenCalledWith(1);
    });

    it('should include comment metadata', async () => {
      const mockComments = [
        mockData.comment({
          id: 1,
          comment: 'Test comment',
          author: mockData.user({ id: 2, username: 'commenter', name: 'Comment Author' }),
          created: '2024-01-01T10:00:00Z',
          updated: '2024-01-01T11:00:00Z',
        }),
      ];
      mockClientMethods(client, {
        listTaskComments: () => Promise.resolve(mockComments),
      });

      const result = await listTaskComments.handler({ taskId: 1 }, client, context);

      const comment = (result as any).comments[0];
      expect(comment).toHaveProperty('id', 1);
      expect(comment).toHaveProperty('comment', 'Test comment');
      expect(comment).toHaveProperty('author');
      expect(comment.author).toHaveProperty('id', 2);
      expect(comment.author).toHaveProperty('username', 'commenter');
      expect(comment.author).toHaveProperty('name', 'Comment Author');
      expect(comment).toHaveProperty('created', '2024-01-01T10:00:00Z');
      expect(comment).toHaveProperty('updated', '2024-01-01T11:00:00Z');
    });

    it('should handle empty comment list', async () => {
      mockClientMethods(client, {
        listTaskComments: () => Promise.resolve([]),
      });

      const result = await listTaskComments.handler({ taskId: 1 }, client, context);

      expect((result as any).comments).toHaveLength(0);
      expect((result as any).count).toBe(0);
    });

    it('should require vikunja:read scope', () => {
      expect(listTaskComments.requiredScopes).toContain('vikunja:read');
    });

    it('should validate required taskId parameter', async () => {
      await expect(listTaskComments.handler({}, client, context)).rejects.toThrow();
    });
  });

  describe('vikunja_add_task_comment', () => {
    const addTaskComment = vikunjaTools.find((t) => t.name === 'vikunja_add_task_comment')!;

    it('should add comment to task', async () => {
      const mockComment = mockData.comment({
        id: 10,
        comment: 'New comment',
        task_id: 1,
        created: '2024-01-15T12:00:00Z',
      });
      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
      });

      const result = await addTaskComment.handler(
        { taskId: 1, comment: 'New comment' },
        client,
        context
      );

      expect(result).toHaveProperty('success', true);
      expect((result as any).comment).toHaveProperty('id', 10);
      expect((result as any).comment).toHaveProperty('comment', 'New comment');
      expect((result as any).comment).toHaveProperty('created');
      expect(client.addTaskComment).toHaveBeenCalledWith(1, 'New comment');
    });

    it('should include author information', async () => {
      const mockComment = mockData.comment({
        id: 10,
        comment: 'Author test',
        author: mockData.user({ id: 5, username: 'author', name: 'Author Name' }),
      });
      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
      });

      const result = await addTaskComment.handler(
        { taskId: 1, comment: 'Author test' },
        client,
        context
      );

      expect((result as any).comment.author).toHaveProperty('id', 5);
      expect((result as any).comment.author).toHaveProperty('username', 'author');
      expect((result as any).comment.author).toHaveProperty('name', 'Author Name');
    });

    it('should handle long comments', async () => {
      const longComment = 'a'.repeat(5000);
      const mockComment = mockData.comment({ id: 10, comment: longComment });
      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
      });

      const result = await addTaskComment.handler(
        { taskId: 1, comment: longComment },
        client,
        context
      );

      expect((result as any).comment.comment).toBe(longComment);
      expect(client.addTaskComment).toHaveBeenCalledWith(1, longComment);
    });

    it('should handle special characters in comments', async () => {
      const specialComment = 'Test with "quotes" and \'apostrophes\' and <tags> and & symbols';
      const mockComment = mockData.comment({ id: 10, comment: specialComment });
      mockClientMethods(client, {
        addTaskComment: () => Promise.resolve(mockComment),
      });

      await addTaskComment.handler({ taskId: 1, comment: specialComment }, client, context);

      expect(client.addTaskComment).toHaveBeenCalledWith(1, specialComment);
    });

    it('should require vikunja:write scope', () => {
      expect(addTaskComment.requiredScopes).toContain('vikunja:write');
    });

    it('should validate required parameters', async () => {
      await expect(addTaskComment.handler({}, client, context)).rejects.toThrow();
      await expect(addTaskComment.handler({ taskId: 1 }, client, context)).rejects.toThrow();
      await expect(
        addTaskComment.handler({ comment: 'test' }, client, context)
      ).rejects.toThrow();
    });
  });
});
