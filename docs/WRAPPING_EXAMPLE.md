# Example: Wrapping an Existing GitHub MCP Server

This is a complete walkthrough of converting an insecure GitHub MCP server to use MCP Gateway.

## Before: Insecure GitHub MCP Server

Here's what a typical **insecure** MCP server looks like:

```typescript
// ❌ INSECURE - DO NOT USE
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // ❌ Shared token for all users!

const server = new Server(
  { name: 'github-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_repos',
      description: 'List GitHub repositories',
      inputSchema: {
        type: 'object',
        properties: {
          username: { type: 'string' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'list_repos') {
    // ❌ Using same token for ALL users
    const response = await fetch(`https://api.github.com/users/${args.username}/repos`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(await response.json(), null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Problems with This Approach:

1. ❌ **Token Passthrough** - Uses single GitHub token for all users
2. ❌ **No User Isolation** - Everyone shares the same API access
3. ❌ **No Authorization** - Anyone can call any tool
4. ❌ **No Rate Limiting** - Can be abused
5. ❌ **No Audit Logging** - Can't track who did what
6. ❌ **Token in Environment** - Insecure storage

---

## After: Secure GitHub MCP Server with Gateway

### Step 1: Project Structure

```bash
cd ~/dev/mcp-gateway/examples
mkdir github
cd github
```

**package.json:**
```json
{
  "name": "@mcp-gateway/example-github",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "mcp-github": "./dist/index.js"
  },
  "dependencies": {
    "@mcp-gateway/server": "workspace:*",
    "@mcp-gateway/core": "workspace:*",
    "@octokit/rest": "^20.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "@types/node": "^22.10.5",
    "vitest": "^2.1.9"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  }
}
```

**tsconfig.json:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### Step 2: GitHub Client Wrapper

**src/github-client.ts:**
```typescript
import { Octokit } from '@octokit/rest';

export class GitHubClient {
  private octokit: Octokit | null = null;

  setToken(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async listRepos(username: string) {
    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    const { data } = await this.octokit.repos.listForUser({
      username,
      per_page: 100,
    });

    return data;
  }

  async getRepo(owner: string, repo: string) {
    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    const { data } = await this.octokit.repos.get({
      owner,
      repo,
    });

    return data;
  }

  async createIssue(owner: string, repo: string, title: string, body?: string) {
    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    const { data } = await this.octokit.issues.create({
      owner,
      repo,
      title,
      body,
    });

    return data;
  }

  async listIssues(owner: string, repo: string) {
    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    const { data } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      per_page: 100,
    });

    return data;
  }
}
```

### Step 3: Tool Definitions

**src/tools.ts:**
```typescript
import type { SecureToolDefinition } from '@mcp-gateway/server';
import type { GitHubClient } from './github-client.js';
import type { SecurityContext } from '@mcp-gateway/core';

export const githubTools: Array<
  Omit<SecureToolDefinition, 'handler'> & {
    handler: (params: any, client: GitHubClient, context: SecurityContext) => Promise<any>;
  }
> = [
  {
    name: 'list_repos',
    description: 'List GitHub repositories for a user',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'GitHub username',
        },
      },
      required: ['username'],
    },
    requiredScopes: ['github:read'],
    handler: async (params, client, context) => {
      const { username } = params as { username: string };
      const repos = await client.listRepos(username);

      return {
        repos: repos.map((repo) => ({
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          stars: repo.stargazers_count,
          url: repo.html_url,
        })),
      };
    },
  },
  {
    name: 'get_repo',
    description: 'Get details about a specific repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
      },
      required: ['owner', 'repo'],
    },
    requiredScopes: ['github:read'],
    handler: async (params, client, context) => {
      const { owner, repo } = params as { owner: string; repo: string };
      const repoData = await client.getRepo(owner, repo);

      return {
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        open_issues: repoData.open_issues_count,
        language: repoData.language,
        url: repoData.html_url,
      };
    },
  },
  {
    name: 'list_issues',
    description: 'List issues for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
      },
      required: ['owner', 'repo'],
    },
    requiredScopes: ['github:read'],
    handler: async (params, client, context) => {
      const { owner, repo } = params as { owner: string; repo: string };
      const issues = await client.listIssues(owner, repo);

      return {
        issues: issues.map((issue) => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          created_at: issue.created_at,
        })),
      };
    },
  },
  {
    name: 'create_issue',
    description: 'Create a new issue in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        title: {
          type: 'string',
          description: 'Issue title',
        },
        body: {
          type: 'string',
          description: 'Issue body/description',
        },
      },
      required: ['owner', 'repo', 'title'],
    },
    requiredScopes: ['github:write'], // ✅ Requires write permission
    handler: async (params, client, context) => {
      const { owner, repo, title, body } = params as {
        owner: string;
        repo: string;
        title: string;
        body?: string;
      };

      const issue = await client.createIssue(owner, repo, title, body);

      return {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        created_at: issue.created_at,
      };
    },
  },
];
```

### Step 4: Secure Server Implementation

**src/index.ts:**
```typescript
#!/usr/bin/env node

import { SecureMCPServer } from '@mcp-gateway/server';
import { GitHubClient } from './github-client.js';
import { githubTools } from './tools.js';

async function main() {
  // ✅ Validate environment
  const JWT_SECRET = process.env.MCP_JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('MCP_JWT_SECRET environment variable is required');
  }

  // ✅ Initialize secure server
  const server = new SecureMCPServer({
    name: 'github-mcp-server',
    version: '1.0.0',
    jwtSecret: JWT_SECRET,
    sessionExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
    tokenExpirySeconds: 3600, // 1 hour
    rateLimitConfig: {
      windowMs: 60000, // 1 minute
      maxRequests: 60, // 60 requests per minute (GitHub's limit is 5000/hour)
    },
    tokenVaultConfig: {
      serviceName: 'mcp-github',
      fallbackToMemory: false, // Fail if keyring unavailable
    },
  });

  // ✅ Initialize GitHub client
  const githubClient = new GitHubClient();

  // ✅ Register all tools with security
  for (const tool of githubTools) {
    server.registerTool({
      ...tool,
      handler: async (params, context) => {
        // ✅ Get user's personal GitHub token from secure vault
        const githubToken = await context.tokenVault.getToken(
          context.auth.userId,
          'github'
        );

        if (!githubToken) {
          throw new Error(
            'GitHub token not configured. Run: mcp-gateway configure --service github'
          );
        }

        // ✅ Set token on client (per-user!)
        githubClient.setToken(githubToken);

        // ✅ Execute tool with user's auth
        return tool.handler(params, githubClient, context);
      },
    });
  }

  // ✅ Add request logging middleware
  server.use(async (request, context) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${context.auth.userId} - ${request.method}`);
    return request;
  });

  // ✅ Add error handling middleware
  server.use(async (request, context) => {
    try {
      return request;
    } catch (error) {
      console.error(`Error in ${request.method}:`, error);
      throw error;
    }
  });

  // ✅ Start server
  console.error('Starting GitHub MCP server...');
  await server.start();
  console.error('GitHub MCP server running');

  // ✅ Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### Step 5: README

**README.md:**
```markdown
# GitHub MCP Server (Secure)

Secure GitHub MCP server using MCP Gateway framework.

## Features

✅ Per-user GitHub token management (no shared tokens)
✅ Session-based authentication
✅ Scope-based authorization (read vs write)
✅ Rate limiting
✅ Audit logging
✅ Secure token storage in OS keyring

## Setup

### 1. Build

\`\`\`bash
cd ~/dev/mcp-gateway
pnpm build
\`\`\`

### 2. Configure

\`\`\`bash
# Set JWT secret for MCP server
export MCP_JWT_SECRET="your-strong-secret-here"

# Configure your GitHub token
mcp-gateway configure --service github --token "ghp_your_github_token"
\`\`\`

### 3. Run

\`\`\`bash
node dist/index.js
\`\`\`

## Tools

| Tool | Scopes Required | Description |
|------|----------------|-------------|
| list_repos | github:read | List user's repositories |
| get_repo | github:read | Get repository details |
| list_issues | github:read | List repository issues |
| create_issue | github:write | Create new issue |

## Claude Desktop Configuration

Add to \`~/Library/Application Support/Claude/claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": [
        "/Users/yourusername/dev/mcp-gateway/examples/github/dist/index.js"
      ],
      "env": {
        "MCP_JWT_SECRET": "your-production-secret"
      }
    }
  }
}
\`\`\`

## Usage

Each user must:

1. Configure their own GitHub token:
   \`\`\`bash
   mcp-gateway configure --service github --token "ghp_their_token"
   \`\`\`

2. Get a session token (one-time):
   \`\`\`bash
   # In your server startup or auth flow:
   const { token } = server.createSession('user-id', ['github:read', 'github:write']);
   \`\`\`

Then they can use GitHub tools in Claude!
```

---

## Comparison

### Before (Insecure):
- ❌ Single token for all users
- ❌ No user isolation
- ❌ No authorization checks
- ❌ No rate limiting
- ❌ No audit trail
- ❌ Token in environment variable

### After (Secure with Gateway):
- ✅ Per-user tokens (isolated access)
- ✅ Session-based authentication
- ✅ Scope-based authorization (read/write)
- ✅ Rate limiting (60 req/min per user)
- ✅ Complete audit logging
- ✅ Tokens stored in OS keyring (encrypted)

---

## Testing

**src/tools.test.ts:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { githubTools } from './tools.js';

describe('GitHub Tools', () => {
  it('should list repos', async () => {
    const mockClient = {
      listRepos: vi.fn().mockResolvedValue([
        {
          name: 'test-repo',
          full_name: 'user/test-repo',
          description: 'Test',
          stargazers_count: 10,
          html_url: 'https://github.com/user/test-repo',
        },
      ]),
    };

    const mockContext = {
      auth: {
        userId: 'user-123',
        sessionId: 'session-456',
        scope: ['github:read'],
      },
      tokenVault: {} as any,
    };

    const result = await githubTools[0].handler(
      { username: 'testuser' },
      mockClient as any,
      mockContext
    );

    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].name).toBe('test-repo');
    expect(mockClient.listRepos).toHaveBeenCalledWith('testuser');
  });

  it('should require write scope for create_issue', () => {
    const createIssueTool = githubTools.find(t => t.name === 'create_issue');
    expect(createIssueTool?.requiredScopes).toContain('github:write');
  });
});
```

---

## Key Takeaways

1. **Each user has their own GitHub token** - Stored securely in OS keyring
2. **Authorization is enforced** - Read vs write scopes
3. **Rate limiting per user** - Prevents abuse
4. **Full audit trail** - Track all API calls
5. **Graceful error handling** - Proper error messages

This is the **secure** way to build MCP servers!
