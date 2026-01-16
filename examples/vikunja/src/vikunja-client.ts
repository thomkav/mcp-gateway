/**
 * Vikunja API Client
 *
 * Simple wrapper around Vikunja's REST API
 */

export interface Task {
  id: number;
  title: string;
  description: string;
  done: boolean;
  projectId: number;
  created: string;
  updated: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  created: string;
  updated: string;
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
    body?: unknown
  ): Promise<T> {
    if (!this.token) {
      throw new Error('Vikunja client not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
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

    return response.json() as Promise<T>;
  }

  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', '/projects');
  }

  async getProject(projectId: number): Promise<Project> {
    return this.request<Project>('GET', `/projects/${projectId}`);
  }

  async createProject(title: string, description?: string): Promise<Project> {
    return this.request<Project>('POST', '/projects', { title, description });
  }

  async listTasks(projectId: number): Promise<Task[]> {
    return this.request<Task[]>('GET', `/projects/${projectId}/tasks`);
  }

  async getTask(taskId: number): Promise<Task> {
    return this.request<Task>('GET', `/tasks/${taskId}`);
  }

  async createTask(
    projectId: number,
    title: string,
    description?: string
  ): Promise<Task> {
    return this.request<Task>('POST', '/projects/${projectId}/tasks', {
      title,
      description,
      projectId,
    });
  }

  async updateTask(
    taskId: number,
    updates: Partial<Task>
  ): Promise<Task> {
    return this.request<Task>('PUT', `/tasks/${taskId}`, updates);
  }

  async deleteTask(taskId: number): Promise<void> {
    await this.request<void>('DELETE', `/tasks/${taskId}`);
  }
}
