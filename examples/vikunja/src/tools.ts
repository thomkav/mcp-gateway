import { z } from 'zod';
import { SecurityContext } from '@mcp-gateway/server';
import type { AuthContext } from '@mcp-gateway/core';
import { VikunjaClient } from './vikunja-client.js';
import { truncateText } from './response-utils.js';

/**
 * Tool handler type with Vikunja client
 */
type VikunjaToolHandler = (
  params: unknown,
  client: VikunjaClient,
  context: SecurityContext
) => Promise<unknown>;

/**
 * Vikunja tool definition
 */
interface VikunjaToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredScopes: string[];
  customAuthCheck?: (context: AuthContext) => boolean;
  handler: VikunjaToolHandler;
}

/**
 * List all projects
 */
const listProjects: VikunjaToolDefinition = {
  name: 'vikunja_list_projects',
  description: 'List all Vikunja projects accessible to the authenticated user.',
  inputSchema: {
    type: 'object',
    properties: {
      page: {
        type: 'number',
        description: 'Page number for pagination (default: 1)',
        default: 1,
      },
      per_page: {
        type: 'number',
        description: 'Number of items per page (default: 50, max: 100)',
        default: 50,
      },
      search: {
        type: 'string',
        description: 'Search term to filter projects by title',
      },
    },
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({
      page: z.number().optional(),
      per_page: z.number().optional(),
      search: z.string().optional(),
    });
    const { page = 1, per_page = 50, search } = schema.parse(params);
    const projects = await client.listProjects({
      page,
      per_page: Math.min(per_page, 100),
      s: search,
    });

    return {
      projects: projects.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        identifier: p.identifier,
        hex_color: p.hex_color,
        is_archived: p.is_archived,
        created: p.created,
        updated: p.updated,
        owner: {
          id: p.owner.id,
          name: p.owner.name,
          username: p.owner.username,
        },
      })),
      count: projects.length,
      pagination: {
        page,
        per_page,
      },
    };
  },
};

/**
 * Get project details
 */
const getProject: VikunjaToolDefinition = {
  name: 'vikunja_get_project',
  description: 'Get detailed information about a Vikunja project, including views and buckets.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The Vikunja project ID',
      },
    },
    required: ['projectId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({ projectId: z.number() });
    const { projectId } = schema.parse(params);
    const project = await client.getProject(projectId);

    // Get the kanban view if available
    const kanbanViewId = await client.getKanbanView(projectId);
    let buckets = null;

    if (kanbanViewId) {
      try {
        buckets = await client.listBuckets(projectId, kanbanViewId);
      } catch (error) {
        // Buckets might not be available, continue without them
      }
    }

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      identifier: project.identifier,
      hex_color: project.hex_color,
      is_archived: project.is_archived,
      created: project.created,
      updated: project.updated,
      owner: {
        id: project.owner.id,
        name: project.owner.name,
        username: project.owner.username,
      },
      views: project.views?.map((v: any) => ({
        id: v.id,
        title: v.title,
        view_kind: v.view_kind,
        position: v.position,
      })),
      ...(buckets && {
        buckets: buckets.map((b: any) => ({
          id: b.id,
          title: b.title,
          position: b.position,
          count: b.count,
        })),
      }),
    };
  },
};

/**
 * Create a new project
 */
const createProject: VikunjaToolDefinition = {
  name: 'vikunja_create_project',
  description: 'Create a new project in Vikunja.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Project title (required)',
      },
      description: {
        type: 'string',
        description: 'Project description (optional)',
      },
      hexColor: {
        type: 'string',
        description: 'Hex color code for the project (optional)',
      },
      isArchived: {
        type: 'boolean',
        description: 'Whether the project is archived (default: false)',
      },
      parentProjectId: {
        type: 'number',
        description: 'Parent project ID for sub-projects (optional)',
      },
    },
    required: ['title'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      title: z.string(),
      description: z.string().optional(),
      hexColor: z.string().optional(),
      isArchived: z.boolean().optional(),
      parentProjectId: z.number().optional(),
    });
    const { title, description, hexColor, isArchived, parentProjectId } = schema.parse(params);

    const createData: any = { title };
    if (description !== undefined) createData.description = description;
    if (hexColor !== undefined) createData.hex_color = hexColor;
    if (isArchived !== undefined) createData.is_archived = isArchived;
    if (parentProjectId !== undefined) createData.parent_project_id = parentProjectId;

    const project = await client.createProject(createData);

    return {
      success: true,
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        hex_color: project.hex_color,
        is_archived: project.is_archived,
        created: project.created,
      },
    };
  },
};

/**
 * Update a project
 */
const updateProject: VikunjaToolDefinition = {
  name: 'vikunja_update_project',
  description: 'Update an existing Vikunja project.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The Vikunja project ID',
      },
      title: {
        type: 'string',
        description: 'New project title (optional)',
      },
      description: {
        type: 'string',
        description: 'New project description (optional)',
      },
      hexColor: {
        type: 'string',
        description: 'New hex color code (optional)',
      },
      isArchived: {
        type: 'boolean',
        description: 'Archive/unarchive the project (optional)',
      },
      parentProjectId: {
        type: 'number',
        description: 'New parent project ID (optional)',
      },
    },
    required: ['projectId'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      projectId: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      hexColor: z.string().optional(),
      isArchived: z.boolean().optional(),
      parentProjectId: z.number().optional(),
    });
    const { projectId, title, description, hexColor, isArchived, parentProjectId } =
      schema.parse(params);

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (hexColor !== undefined) updateData.hex_color = hexColor;
    if (isArchived !== undefined) updateData.is_archived = isArchived;
    if (parentProjectId !== undefined) updateData.parent_project_id = parentProjectId;

    const project = await client.updateProject(projectId, updateData);

    return {
      success: true,
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        hex_color: project.hex_color,
        is_archived: project.is_archived,
        updated: project.updated,
      },
    };
  },
};

/**
 * Delete a project
 */
const deleteProject: VikunjaToolDefinition = {
  name: 'vikunja_delete_project',
  description: 'Delete a Vikunja project. WARNING: This is permanent and cannot be undone.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The Vikunja project ID to delete',
      },
    },
    required: ['projectId'],
  },
  requiredScopes: ['vikunja:write', 'vikunja:delete'],
  customAuthCheck: (context) => {
    // Additional safety check: require explicit delete scope
    return context.scope.includes('vikunja:delete');
  },
  handler: async (params, client) => {
    const schema = z.object({ projectId: z.number() });
    const { projectId } = schema.parse(params);
    await client.deleteProject(projectId);

    return {
      success: true,
      message: `Project ${projectId} deleted successfully`,
    };
  },
};

/**
 * List tasks in a project
 */
const listTasks: VikunjaToolDefinition = {
  name: 'vikunja_list_tasks',
  description:
    'List tasks in a Vikunja project with pagination. Returns tasks with truncated descriptions (500 chars max) by default. Use get_vikunja_task for full task details. Default fields: id, title, description (truncated), done, due_date.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The Vikunja project ID (required)',
      },
      viewId: {
        type: 'number',
        description: 'The Vikunja view ID (optional, for kanban views)',
      },
      bucketId: {
        type: 'number',
        description: 'The Vikunja bucket ID (optional, filters to bucket)',
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (default: 1)',
        default: 1,
      },
      per_page: {
        type: 'number',
        description: 'Number of items per page (default: 50, max: 100)',
        default: 50,
      },
      includeFullDescription: {
        type: 'boolean',
        description: 'Include full description without truncation (default: false)',
        default: false,
      },
      fields: {
        type: 'array',
        description:
          'Specific fields to return. If not specified, returns default fields (id, title, description, done, due_date). Available fields: id, title, description, done, due_date, priority, created, updated, bucket_id, position, labels, assignees. Note: id is always included.',
        items: {
          type: 'string',
          enum: [
            'id',
            'title',
            'description',
            'done',
            'due_date',
            'priority',
            'created',
            'updated',
            'bucket_id',
            'position',
            'labels',
            'assignees',
            'start_date',
            'end_date',
          ],
        },
      },
      output_mode: {
        type: 'string',
        enum: ['full', 'summary'],
        description:
          'Output mode: "full" returns all requested fields (default), "summary" returns only id, title, done, priority, due_date for efficiency.',
        default: 'full',
      },
    },
    required: ['projectId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({
      projectId: z.number(),
      viewId: z.number().optional(),
      bucketId: z.number().optional(),
      page: z.number().optional(),
      per_page: z.number().optional(),
      includeFullDescription: z.boolean().optional(),
      fields: z.array(z.string()).optional(),
      output_mode: z.enum(['full', 'summary']).optional(),
    });
    const {
      projectId,
      viewId,
      bucketId,
      page = 1,
      per_page = 50,
      includeFullDescription = false,
      fields: requestedFields,
      output_mode = 'full',
    } = schema.parse(params);

    // Summary mode overrides fields to minimal set
    const summaryFields = ['id', 'title', 'done', 'priority', 'due_date'];
    const defaultFields = ['id', 'title', 'description', 'done', 'due_date'];
    let fieldsToInclude = output_mode === 'summary' ? summaryFields : requestedFields || defaultFields;

    // Ensure id is always included
    if (!fieldsToInclude.includes('id')) {
      fieldsToInclude = ['id', ...fieldsToInclude];
    }

    // Fetch tasks
    let tasksData: any;
    if (viewId) {
      tasksData = await client.listTasksInView(projectId, viewId, {
        page,
        per_page: Math.min(per_page, 100),
      });
    } else {
      tasksData = await client.listTasks(projectId, { page, per_page: Math.min(per_page, 100) });
    }

    // Handle grouped tasks (from kanban views) or array of tasks
    let allTasks: any[];
    if (Array.isArray(tasksData)) {
      allTasks = tasksData;
    } else {
      // Tasks grouped by bucket - flatten them
      allTasks = Object.values(tasksData).flat();
    }

    // Filter by bucket if specified
    if (bucketId !== undefined) {
      allTasks = allTasks.filter((t: any) => t.bucket_id === bucketId);
    }

    // Map tasks with field filtering
    const tasks = allTasks.map((t: any) => {
      const task: Record<string, any> = {};

      fieldsToInclude.forEach((field) => {
        switch (field) {
          case 'id':
            task.id = t.id;
            break;
          case 'title':
            task.title = t.title;
            break;
          case 'description':
            task.description = includeFullDescription ? t.description : truncateText(t.description);
            break;
          case 'done':
            task.done = t.done;
            break;
          case 'due_date':
            task.due_date = t.due_date;
            break;
          case 'priority':
            task.priority = t.priority;
            break;
          case 'created':
            task.created = t.created;
            break;
          case 'updated':
            task.updated = t.updated;
            break;
          case 'bucket_id':
            task.bucket_id = t.bucket_id;
            break;
          case 'position':
            task.position = t.position;
            break;
          case 'labels':
            task.labels = t.labels?.map((l: any) => ({
              id: l.id,
              title: l.title,
              hex_color: l.hex_color,
            }));
            break;
          case 'assignees':
            task.assignees = t.assignees?.map((a: any) => ({
              id: a.id,
              name: a.name,
              username: a.username,
            }));
            break;
          case 'start_date':
            task.start_date = t.start_date;
            break;
          case 'end_date':
            task.end_date = t.end_date;
            break;
        }
      });

      return task;
    });

    // Build response with conditional pagination
    const response: {
      tasks: any[];
      count: number;
      pagination?: { page: number; per_page: number; has_more: boolean };
    } = {
      tasks,
      count: tasks.length,
    };

    // Only include pagination if there might be more results
    if (tasks.length === Math.min(per_page, 100)) {
      response.pagination = {
        page,
        per_page,
        has_more: true,
      };
    }

    return response;
  },
};

/**
 * Get task details
 */
const getTask: VikunjaToolDefinition = {
  name: 'vikunja_get_task',
  description: 'Get detailed information about a specific Vikunja task.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID',
      },
    },
    required: ['taskId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({ taskId: z.number() });
    const { taskId } = schema.parse(params);
    const task = await client.getTask(taskId);

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      done: task.done,
      done_at: task.done_at,
      due_date: task.due_date,
      priority: task.priority,
      start_date: task.start_date,
      end_date: task.end_date,
      created: task.created,
      updated: task.updated,
      project_id: task.project_id,
      bucket_id: task.bucket_id,
      position: task.position,
      percent_done: task.percent_done,
      labels: task.labels?.map((l: any) => ({
        id: l.id,
        title: l.title,
        hex_color: l.hex_color,
      })),
      assignees: task.assignees?.map((a: any) => ({
        id: a.id,
        name: a.name,
        username: a.username,
      })),
      created_by: {
        id: task.created_by.id,
        name: task.created_by.name,
        username: task.created_by.username,
      },
    };
  },
};

/**
 * List buckets in a project view
 */
const listBuckets: VikunjaToolDefinition = {
  name: 'vikunja_list_buckets',
  description: 'List all buckets in a Vikunja project view (for kanban boards).',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The Vikunja project ID',
      },
      viewId: {
        type: 'number',
        description: 'The Vikunja view ID (must be a kanban view)',
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (default: 1)',
        default: 1,
      },
      per_page: {
        type: 'number',
        description: 'Number of items per page (default: 50, max: 100)',
        default: 50,
      },
    },
    required: ['projectId', 'viewId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({
      projectId: z.number(),
      viewId: z.number(),
      page: z.number().optional(),
      per_page: z.number().optional(),
    });
    const { projectId, viewId, page = 1, per_page = 50 } = schema.parse(params);

    const buckets = await client.listBuckets(projectId, viewId, {
      page,
      per_page: Math.min(per_page, 100),
    });

    return {
      buckets: buckets.map((b: any) => ({
        id: b.id,
        title: b.title,
        position: b.position,
        limit: b.limit,
        count: b.count,
        created: b.created,
        updated: b.updated,
      })),
      count: buckets.length,
      pagination: {
        page,
        per_page,
      },
    };
  },
};

/**
 * Create a bucket
 */
const createBucket: VikunjaToolDefinition = {
  name: 'vikunja_create_bucket',
  description: 'Create a new bucket in a Vikunja project view (for kanban boards).',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The Vikunja project ID',
      },
      viewId: {
        type: 'number',
        description: 'The Vikunja view ID (must be a kanban view)',
      },
      title: {
        type: 'string',
        description: 'The bucket title',
      },
      position: {
        type: 'number',
        description: 'The bucket position (optional)',
      },
    },
    required: ['projectId', 'viewId', 'title'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      projectId: z.number(),
      viewId: z.number(),
      title: z.string(),
      position: z.number().optional(),
    });
    const { projectId, viewId, title, position } = schema.parse(params);

    const bucket = await client.createBucket(projectId, viewId, {
      title,
      ...(position !== undefined && { position }),
    });

    return {
      success: true,
      bucket: {
        id: bucket.id,
        title: bucket.title,
        position: bucket.position,
        created: bucket.created,
      },
    };
  },
};

/**
 * Update a bucket
 */
const updateBucket: VikunjaToolDefinition = {
  name: 'vikunja_update_bucket',
  description: 'Update an existing bucket in a Vikunja kanban view.',
  inputSchema: {
    type: 'object',
    properties: {
      bucketId: {
        type: 'number',
        description: 'The Vikunja bucket ID',
      },
      title: {
        type: 'string',
        description: 'New bucket title (optional)',
      },
      position: {
        type: 'number',
        description: 'New bucket position (optional)',
      },
      limit: {
        type: 'number',
        description: 'Task limit for the bucket (optional)',
      },
    },
    required: ['bucketId'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      bucketId: z.number(),
      title: z.string().optional(),
      position: z.number().optional(),
      limit: z.number().optional(),
    });
    const { bucketId, title, position, limit } = schema.parse(params);

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (position !== undefined) updateData.position = position;
    if (limit !== undefined) updateData.limit = limit;

    const bucket = await client.updateBucket(bucketId, updateData);

    return {
      success: true,
      bucket: {
        id: bucket.id,
        title: bucket.title,
        position: bucket.position,
        limit: bucket.limit,
        updated: bucket.updated,
      },
    };
  },
};

/**
 * Delete a bucket
 */
const deleteBucket: VikunjaToolDefinition = {
  name: 'vikunja_delete_bucket',
  description:
    'Delete a bucket from a Vikunja kanban view. WARNING: This is permanent and cannot be undone.',
  inputSchema: {
    type: 'object',
    properties: {
      bucketId: {
        type: 'number',
        description: 'The Vikunja bucket ID to delete',
      },
    },
    required: ['bucketId'],
  },
  requiredScopes: ['vikunja:write', 'vikunja:delete'],
  customAuthCheck: (context) => {
    // Additional safety check: require explicit delete scope
    return context.scope.includes('vikunja:delete');
  },
  handler: async (params, client) => {
    const schema = z.object({ bucketId: z.number() });
    const { bucketId } = schema.parse(params);
    await client.deleteBucket(bucketId);

    return {
      success: true,
      message: `Bucket ${bucketId} deleted successfully`,
    };
  },
};

/**
 * Create a new task
 */
const createTask: VikunjaToolDefinition = {
  name: 'vikunja_create_task',
  description: 'Create a new task in Vikunja.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'Project ID to add task to (required)',
      },
      title: {
        type: 'string',
        description: 'Task title (required)',
      },
      description: {
        type: 'string',
        description: 'Task description (optional)',
      },
      bucketId: {
        type: 'number',
        description: 'Bucket ID to add task to (optional, for kanban)',
      },
      dueDate: {
        type: 'string',
        description: 'Due date in ISO 8601 format (optional)',
      },
      priority: {
        type: 'number',
        description: 'Task priority 0-5 (default: 0)',
      },
    },
    required: ['projectId', 'title'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      projectId: z.number(),
      title: z.string(),
      description: z.string().optional(),
      bucketId: z.number().optional(),
      dueDate: z.string().optional(),
      priority: z.number().optional(),
    });
    const { projectId, title, description, bucketId, dueDate, priority } = schema.parse(params);

    const task = await client.createTask(projectId, {
      title,
      ...(description && { description }),
      ...(bucketId !== undefined && { bucket_id: bucketId }),
      ...(dueDate && { due_date: dueDate }),
      ...(priority !== undefined && { priority }),
    });

    return {
      success: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        priority: task.priority,
        bucket_id: task.bucket_id,
      },
    };
  },
};

/**
 * Update a task
 */
const updateTask: VikunjaToolDefinition = {
  name: 'vikunja_update_task',
  description: 'Update an existing Vikunja task.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID',
      },
      title: {
        type: 'string',
        description: 'New task title (optional)',
      },
      description: {
        type: 'string',
        description: 'New task description (optional)',
      },
      done: {
        type: 'boolean',
        description: 'Mark task as done or not (optional)',
      },
      dueDate: {
        type: 'string',
        description: 'New due date in ISO 8601 format (optional)',
      },
      priority: {
        type: 'number',
        description: 'New task priority 0-5 (optional)',
      },
      bucketId: {
        type: 'number',
        description: 'Move task to different bucket (optional)',
      },
    },
    required: ['taskId'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      taskId: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      done: z.boolean().optional(),
      dueDate: z.string().optional(),
      priority: z.number().optional(),
      bucketId: z.number().optional(),
    });
    const { taskId, title, description, done, dueDate, priority, bucketId } = schema.parse(params);

    // First fetch the current task to preserve existing values
    const currentTask = await client.getTask(taskId);

    // Build update data by merging changes into current task state
    const updateData: Record<string, any> = {
      // Preserve existing values
      title: currentTask.title,
      description: currentTask.description,
      done: currentTask.done,
      due_date: currentTask.due_date,
      priority: currentTask.priority,
      bucket_id: currentTask.bucket_id,
    };

    // Apply requested updates
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (done !== undefined) updateData.done = done;
    if (dueDate !== undefined) updateData.due_date = dueDate;
    if (priority !== undefined) updateData.priority = priority;
    if (bucketId !== undefined) updateData.bucket_id = bucketId;

    const task = await client.updateTask(taskId, updateData);

    return {
      success: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        done: task.done,
        due_date: task.due_date,
        priority: task.priority,
        bucket_id: task.bucket_id,
      },
    };
  },
};

/**
 * Delete a task
 */
const deleteTask: VikunjaToolDefinition = {
  name: 'vikunja_delete_task',
  description: 'Delete a Vikunja task. WARNING: This is permanent and cannot be undone.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID to delete',
      },
    },
    required: ['taskId'],
  },
  requiredScopes: ['vikunja:write', 'vikunja:delete'],
  customAuthCheck: (context) => {
    // Additional safety check: require explicit delete scope
    return context.scope.includes('vikunja:delete');
  },
  handler: async (params, client) => {
    const schema = z.object({ taskId: z.number() });
    const { taskId } = schema.parse(params);
    await client.deleteTask(taskId);

    return {
      success: true,
      message: `Task ${taskId} deleted successfully`,
    };
  },
};

/**
 * List task comments
 */
const listTaskComments: VikunjaToolDefinition = {
  name: 'vikunja_list_task_comments',
  description: 'List all comments on a Vikunja task.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID',
      },
    },
    required: ['taskId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({ taskId: z.number() });
    const { taskId } = schema.parse(params);
    const comments = await client.listTaskComments(taskId);

    return {
      comments: comments.map((c: any) => ({
        id: c.id,
        comment: c.comment,
        author: {
          id: c.author?.id,
          name: c.author?.name,
          username: c.author?.username,
        },
        created: c.created,
        updated: c.updated,
      })),
      count: comments.length,
    };
  },
};

/**
 * Add task comment
 */
const addTaskComment: VikunjaToolDefinition = {
  name: 'vikunja_add_task_comment',
  description: 'Add a comment to a Vikunja task.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID',
      },
      comment: {
        type: 'string',
        description: 'The comment text to add',
      },
    },
    required: ['taskId', 'comment'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      taskId: z.number(),
      comment: z.string(),
    });
    const { taskId, comment } = schema.parse(params);
    const commentResult = await client.addTaskComment(taskId, comment);

    return {
      success: true,
      comment: {
        id: commentResult.id,
        comment: commentResult.comment,
        author: {
          id: commentResult.author?.id,
          name: commentResult.author?.name,
          username: commentResult.author?.username,
        },
        created: commentResult.created,
      },
    };
  },
};

/**
 * Get next task (workflow helper)
 */
const getNextTask: VikunjaToolDefinition = {
  name: 'vikunja_get_next_task',
  description:
    'Get the highest priority actionable task from a project. Returns a single task based on the selection strategy. Use this to find the next task to work on.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The Vikunja project ID',
      },
      excludeDone: {
        type: 'boolean',
        description: 'Exclude completed tasks (default: true)',
        default: true,
      },
      priorityMin: {
        type: 'number',
        description: 'Minimum priority (1-5, where 5 is highest)',
      },
      dueBefore: {
        type: 'string',
        description: 'Only tasks due before this ISO date',
      },
      strategy: {
        type: 'string',
        enum: ['priority', 'due_date', 'fifo'],
        description: 'Task selection strategy (default: priority)',
        default: 'priority',
      },
    },
    required: ['projectId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({
      projectId: z.number(),
      excludeDone: z.boolean().optional(),
      priorityMin: z.number().optional(),
      dueBefore: z.string().optional(),
      strategy: z.enum(['priority', 'due_date', 'fifo']).optional(),
    });
    const {
      projectId,
      excludeDone = true,
      priorityMin,
      dueBefore,
      strategy = 'priority',
    } = schema.parse(params);

    // Fetch all tasks
    const allTasks = await client.listTasks(projectId);

    // Filter tasks
    let tasks = allTasks.filter((t: any) => {
      // Exclude done tasks if requested
      if (excludeDone && t.done) return false;

      // Filter by minimum priority
      if (priorityMin !== undefined && t.priority < priorityMin) return false;

      // Filter by due date
      if (dueBefore && t.due_date) {
        const taskDue = new Date(t.due_date);
        const beforeDate = new Date(dueBefore);
        if (taskDue > beforeDate) return false;
      }

      return true;
    });

    // Sort by strategy
    tasks.sort((a: any, b: any) => {
      switch (strategy) {
        case 'priority':
          // Priority DESC (higher first), then position ASC
          if (b.priority !== a.priority) return b.priority - a.priority;
          return a.position - b.position;
        case 'due_date':
          // Due date ASC (soonest first), nulls last
          if (!a.due_date && !b.due_date) return a.priority - b.priority;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          if (diff !== 0) return diff;
          return b.priority - a.priority;
        case 'fifo':
        default:
          // Position ASC (first in list)
          return a.position - b.position;
      }
    });

    if (tasks.length === 0) {
      return {
        task: null,
        message: 'No actionable tasks found matching the criteria',
      };
    }

    const nextTask = tasks[0];
    return {
      task: {
        id: nextTask.id,
        title: nextTask.title,
        priority: nextTask.priority,
        due_date: nextTask.due_date,
        done: nextTask.done,
        bucket_id: nextTask.bucket_id,
        description: truncateText(nextTask.description, 200),
      },
      remaining_count: tasks.length - 1,
    };
  },
};

/**
 * Claim a task (workflow helper)
 */
const claimTask: VikunjaToolDefinition = {
  name: 'vikunja_claim_task',
  description:
    'Mark a task as in-progress and log the session start. Use this before beginning work on a task.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID to claim',
      },
      agentId: {
        type: 'string',
        description: 'Identifier for the agent/session claiming the task',
      },
      note: {
        type: 'string',
        description: 'Optional note about the planned approach',
      },
    },
    required: ['taskId'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      taskId: z.number(),
      agentId: z.string().optional(),
      note: z.string().optional(),
    });
    const { taskId, agentId, note } = schema.parse(params);

    // Add session start comment
    const timestamp = new Date().toISOString();
    let commentText = `[Session started]\nAgent: ${agentId || 'unknown'}\nTime: ${timestamp}`;
    if (note) {
      commentText += `\n\nApproach: ${note}`;
    }

    await client.addTaskComment(taskId, commentText);

    // Get and return updated task
    const task = await client.getTask(taskId);

    return {
      success: true,
      message: 'Task claimed successfully',
      task: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        due_date: task.due_date,
        bucket_id: task.bucket_id,
      },
    };
  },
};

/**
 * Complete task with summary (workflow helper)
 */
const completeTaskWithSummary: VikunjaToolDefinition = {
  name: 'vikunja_complete_task_with_summary',
  description:
    'Mark a task as done and add a structured completion summary. Preserves the original description by adding the summary as a comment.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID',
      },
      summary: {
        type: 'string',
        description: 'Summary of what was accomplished',
      },
      artifacts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Links to commits, PRs, or files created',
      },
      nextSteps: {
        type: 'string',
        description: 'Follow-up actions if any',
      },
    },
    required: ['taskId', 'summary'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      taskId: z.number(),
      summary: z.string(),
      artifacts: z.array(z.string()).optional(),
      nextSteps: z.string().optional(),
    });
    const { taskId, summary, artifacts, nextSteps } = schema.parse(params);

    // Build structured comment
    let commentText = `[Session completed]\n\n**Summary:** ${summary}`;

    if (artifacts && artifacts.length > 0) {
      commentText += `\n\n**Artifacts:**\n${artifacts.map((a) => `- ${a}`).join('\n')}`;
    }

    if (nextSteps) {
      commentText += `\n\n**Next steps:** ${nextSteps}`;
    }

    commentText += `\n\n_Completed at ${new Date().toISOString()}_`;

    // Add completion comment
    await client.addTaskComment(taskId, commentText);

    // Mark task as done
    const task = await client.updateTask(taskId, { done: true });

    return {
      success: true,
      message: 'Task completed with summary',
      task: {
        id: task.id,
        title: task.title,
        done: task.done,
      },
    };
  },
};

/**
 * Add task checkpoint (workflow helper)
 */
const addTaskCheckpoint: VikunjaToolDefinition = {
  name: 'vikunja_add_task_checkpoint',
  description:
    'Add a progress checkpoint comment to a task. Use this during long-running work sessions to log progress.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID',
      },
      message: {
        type: 'string',
        description: 'Checkpoint message (what was done, what is next)',
      },
      artifacts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Links to any artifacts created so far',
      },
    },
    required: ['taskId', 'message'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      taskId: z.number(),
      message: z.string(),
      artifacts: z.array(z.string()).optional(),
    });
    const { taskId, message, artifacts } = schema.parse(params);

    // Build checkpoint comment
    let commentText = `[Checkpoint] ${message}`;

    if (artifacts && artifacts.length > 0) {
      commentText += `\n\nArtifacts:\n${artifacts.map((a) => `- ${a}`).join('\n')}`;
    }

    commentText += `\n\n_${new Date().toISOString()}_`;

    const comment = await client.addTaskComment(taskId, commentText);

    return {
      success: true,
      checkpoint: {
        id: comment.id,
        message: message,
        created: comment.created,
      },
    };
  },
};

/**
 * Release a task (workflow helper)
 */
const releaseTask: VikunjaToolDefinition = {
  name: 'vikunja_release_task',
  description: 'Release a claimed task back to todo status without completing it.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The Vikunja task ID',
      },
      reason: {
        type: 'string',
        description: 'Why the task is being released',
      },
    },
    required: ['taskId'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      taskId: z.number(),
      reason: z.string().optional(),
    });
    const { taskId, reason } = schema.parse(params);

    // Add release comment
    let commentText = `[Session released]\n${reason ? `Reason: ${reason}` : 'No reason specified'}`;
    commentText += `\n\n_${new Date().toISOString()}_`;

    await client.addTaskComment(taskId, commentText);

    // Get and return updated task
    const task = await client.getTask(taskId);

    return {
      success: true,
      message: 'Task released',
      task: {
        id: task.id,
        title: task.title,
        done: task.done,
        bucket_id: task.bucket_id,
      },
    };
  },
};

/**
 * Export all tools (21 total)
 */
export const vikunjaTools: VikunjaToolDefinition[] = [
  // Project tools (5)
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  // Task tools (6)
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  // Bucket tools (4)
  listBuckets,
  createBucket,
  updateBucket,
  deleteBucket,
  // Comment tools (2)
  listTaskComments,
  addTaskComment,
  // Workflow tools (4)
  getNextTask,
  claimTask,
  completeTaskWithSummary,
  addTaskCheckpoint,
  releaseTask,
];
