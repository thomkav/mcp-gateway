import { z } from 'zod';
import { SecurityContext } from '@mcp-gateway/server';
import { VikunjaClient } from './vikunja-client.js';

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
  handler: VikunjaToolHandler;
}

/**
 * List all projects
 */
const listProjects: VikunjaToolDefinition = {
  name: 'vikunja_list_projects',
  description: 'List all Vikunja projects accessible to the user',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const projects = await client.listProjects();
    return { projects };
  },
};

/**
 * Get project details
 */
const getProject: VikunjaToolDefinition = {
  name: 'vikunja_get_project',
  description: 'Get details of a specific Vikunja project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The ID of the project to retrieve',
      },
    },
    required: ['projectId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({ projectId: z.number() });
    const { projectId } = schema.parse(params);
    const project = await client.getProject(projectId);
    return { project };
  },
};

/**
 * Create a new project
 */
const createProject: VikunjaToolDefinition = {
  name: 'vikunja_create_project',
  description: 'Create a new Vikunja project',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The title of the project',
      },
      description: {
        type: 'string',
        description: 'The description of the project (optional)',
      },
    },
    required: ['title'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({
      title: z.string(),
      description: z.string().optional(),
    });
    const { title, description } = schema.parse(params);
    const project = await client.createProject(title, description);
    return { project };
  },
};

/**
 * List tasks in a project
 */
const listTasks: VikunjaToolDefinition = {
  name: 'vikunja_list_tasks',
  description: 'List all tasks in a Vikunja project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The ID of the project',
      },
    },
    required: ['projectId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({ projectId: z.number() });
    const { projectId } = schema.parse(params);
    const tasks = await client.listTasks(projectId);
    return { tasks };
  },
};

/**
 * Get task details
 */
const getTask: VikunjaToolDefinition = {
  name: 'vikunja_get_task',
  description: 'Get details of a specific Vikunja task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The ID of the task to retrieve',
      },
    },
    required: ['taskId'],
  },
  requiredScopes: ['vikunja:read'],
  handler: async (params, client) => {
    const schema = z.object({ taskId: z.number() });
    const { taskId } = schema.parse(params);
    const task = await client.getTask(taskId);
    return { task };
  },
};

/**
 * Create a new task
 */
const createTask: VikunjaToolDefinition = {
  name: 'vikunja_create_task',
  description: 'Create a new task in a Vikunja project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'number',
        description: 'The ID of the project',
      },
      title: {
        type: 'string',
        description: 'The title of the task',
      },
      description: {
        type: 'string',
        description: 'The description of the task (optional)',
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
    });
    const { projectId, title, description } = schema.parse(params);
    const task = await client.createTask(projectId, title, description);
    return { task };
  },
};

/**
 * Update a task
 */
const updateTask: VikunjaToolDefinition = {
  name: 'vikunja_update_task',
  description: 'Update an existing Vikunja task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The ID of the task to update',
      },
      title: {
        type: 'string',
        description: 'The new title (optional)',
      },
      description: {
        type: 'string',
        description: 'The new description (optional)',
      },
      done: {
        type: 'boolean',
        description: 'Whether the task is completed (optional)',
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
    });
    const { taskId, ...updates } = schema.parse(params);
    const task = await client.updateTask(taskId, updates);
    return { task };
  },
};

/**
 * Delete a task
 */
const deleteTask: VikunjaToolDefinition = {
  name: 'vikunja_delete_task',
  description: 'Delete a Vikunja task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'number',
        description: 'The ID of the task to delete',
      },
    },
    required: ['taskId'],
  },
  requiredScopes: ['vikunja:write'],
  handler: async (params, client) => {
    const schema = z.object({ taskId: z.number() });
    const { taskId } = schema.parse(params);
    await client.deleteTask(taskId);
    return { success: true, message: `Task ${taskId} deleted` };
  },
};

/**
 * Export all tools
 */
export const vikunjaTools: VikunjaToolDefinition[] = [
  listProjects,
  getProject,
  createProject,
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
];
