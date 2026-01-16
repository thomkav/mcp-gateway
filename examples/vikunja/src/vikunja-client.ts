/**
 * Vikunja API Client
 *
 * Enhanced wrapper around Vikunja's REST API with full feature support
 */

export interface User {
  id: number;
  username: string;
  name?: string;
  email?: string;
}

export interface Label {
  id: number;
  title: string;
  hex_color?: string;
  created: string;
  updated: string;
}

export interface View {
  id: number;
  title: string;
  view_kind: string;
  position: number;
  project_id: number;
  created: string;
  updated: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  done: boolean;
  done_at?: string;
  project_id: number;
  bucket_id?: number;
  due_date?: string;
  start_date?: string;
  end_date?: string;
  priority: number;
  position: number;
  percent_done?: number;
  created: string;
  updated: string;
  labels?: Label[];
  assignees?: User[];
  created_by: User;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  identifier?: string;
  hex_color?: string;
  is_archived?: boolean;
  parent_project_id?: number;
  created: string;
  updated: string;
  owner: User;
  views?: View[];
}

export interface Comment {
  id: number;
  comment: string;
  task_id?: number;
  author: User;
  created: string;
  updated: string;
}

export interface Bucket {
  id: number;
  title: string;
  project_id: number;
  view_id?: number;
  position: number;
  limit: number;
  count?: number;
  created: string;
  updated: string;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface ListProjectsParams extends PaginationParams {
  s?: string; // search term
}

export interface ListTasksParams extends PaginationParams {
  filter_by?: string[];
  filter_value?: string[];
  filter_comparator?: string[];
  filter_concat?: string;
  s?: string; // search term
}

export interface CreateProjectParams {
  title: string;
  description?: string;
  hex_color?: string;
  is_archived?: boolean;
  parent_project_id?: number;
}

export interface UpdateProjectParams {
  title?: string;
  description?: string;
  hex_color?: string;
  is_archived?: boolean;
  parent_project_id?: number;
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  bucket_id?: number;
  due_date?: string;
  start_date?: string;
  end_date?: string;
  priority?: number;
  position?: number;
}

export interface UpdateTaskParams {
  title?: string;
  description?: string;
  done?: boolean;
  bucket_id?: number;
  due_date?: string;
  start_date?: string;
  end_date?: string;
  priority?: number;
  position?: number;
}

export interface CreateBucketParams {
  title: string;
  limit?: number;
  position?: number;
}

export class VikunjaClient {
  private token: string | null = null;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.VIKUNJA_URL || 'http://localhost:3456';
  }

  setToken(token: string): void {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number>
  ): Promise<T> {
    if (!this.token) {
      throw new Error('Vikunja client not authenticated');
    }

    let url = `${this.baseUrl}/api/v1${path}`;

    // Add query parameters if provided
    if (queryParams) {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        params.append(key, String(value));
      });
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vikunja API error: ${response.status} - ${error}`);
    }

    // Handle empty responses (e.g., DELETE operations)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // Projects API

  async listProjects(params?: ListProjectsParams): Promise<any[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.per_page) queryParams.per_page = params.per_page;
    if (params?.s) queryParams.s = params.s;

    return this.request<any[]>(
      'GET',
      '/projects',
      undefined,
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    );
  }

  async getProject(projectId: number): Promise<any> {
    return this.request<any>('GET', `/projects/${projectId}`);
  }

  async createProject(params: CreateProjectParams): Promise<any> {
    return this.request<any>('PUT', '/projects', params);
  }

  async updateProject(projectId: number, params: UpdateProjectParams): Promise<any> {
    return this.request<any>('POST', `/projects/${projectId}`, params);
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.request<void>('DELETE', `/projects/${projectId}`);
  }

  // Tasks API

  async listTasks(projectId: number, params?: ListTasksParams): Promise<any[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.per_page) queryParams.per_page = params.per_page;
    if (params?.s) queryParams.s = params.s;

    return this.request<any[]>(
      'GET',
      `/projects/${projectId}/tasks`,
      undefined,
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    );
  }

  async listTasksInView(projectId: number, viewId: number, params?: ListTasksParams): Promise<any> {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.per_page) queryParams.per_page = params.per_page;

    return this.request<any>(
      'GET',
      `/projects/${projectId}/views/${viewId}/tasks`,
      undefined,
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    );
  }

  async getTask(taskId: number): Promise<any> {
    return this.request<any>('GET', `/tasks/${taskId}`);
  }

  async createTask(projectId: number, params: CreateTaskParams): Promise<any> {
    return this.request<any>('PUT', `/projects/${projectId}/tasks`, params);
  }

  async updateTask(taskId: number, params: UpdateTaskParams): Promise<any> {
    return this.request<any>('POST', `/tasks/${taskId}`, params);
  }

  async deleteTask(taskId: number): Promise<void> {
    await this.request<void>('DELETE', `/tasks/${taskId}`);
  }

  // Comments API

  async listTaskComments(taskId: number, params?: PaginationParams): Promise<any[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.per_page) queryParams.per_page = params.per_page;

    return this.request<any[]>(
      'GET',
      `/tasks/${taskId}/comments`,
      undefined,
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    );
  }

  async addTaskComment(taskId: number, comment: string): Promise<any> {
    return this.request<any>('PUT', `/tasks/${taskId}/comments`, { comment });
  }

  async updateComment(taskId: number, commentId: number, comment: string): Promise<any> {
    return this.request<any>('POST', `/tasks/${taskId}/comments/${commentId}`, { comment });
  }

  async deleteComment(taskId: number, commentId: number): Promise<void> {
    await this.request<void>('DELETE', `/tasks/${taskId}/comments/${commentId}`);
  }

  // Buckets API

  async listBuckets(projectId: number, viewId: number, params?: PaginationParams): Promise<any[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.per_page) queryParams.per_page = params.per_page;

    return this.request<any[]>(
      'GET',
      `/projects/${projectId}/views/${viewId}/buckets`,
      undefined,
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    );
  }

  async createBucket(projectId: number, viewId: number, params: CreateBucketParams): Promise<any> {
    return this.request<any>('PUT', `/projects/${projectId}/views/${viewId}/buckets`, params);
  }

  async updateBucket(bucketId: number, params: Partial<CreateBucketParams>): Promise<any> {
    return this.request<any>('POST', `/buckets/${bucketId}`, params);
  }

  async deleteBucket(bucketId: number): Promise<void> {
    await this.request<void>('DELETE', `/buckets/${bucketId}`);
  }

  // Views API

  async getKanbanView(projectId: number): Promise<number | null> {
    const project = await this.getProject(projectId);
    const kanbanView = project.views?.find((v: any) => v.view_kind === 'kanban');
    return kanbanView?.id || null;
  }

  // Workflow Helpers

  async markTaskDone(taskId: number): Promise<any> {
    return this.updateTask(taskId, { done: true });
  }

  async markTaskUndone(taskId: number): Promise<any> {
    return this.updateTask(taskId, { done: false });
  }

  async moveToBucket(taskId: number, bucketId: number): Promise<any> {
    return this.updateTask(taskId, { bucket_id: bucketId });
  }
}
