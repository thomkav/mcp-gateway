# Phase 4: Token Migration - Setup Complete

## ✅ Migration Status

### Completed Steps

1. **Claude Desktop Configuration** ✅
   - Path: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - MCP_JWT_SECRET: Configured with secure random secret
   - VIKUNJA_URL: Set to `https://app.vikunja.cloud`
   - Server command: Points to `/Users/thomasmacbookair/dev/mcp-gateway/examples/vikunja/dist/index.js`

2. **Environment Variables** ✅
   - No .env file exists (secure - tokens now in keyring)
   - VIKUNJA_URL is configured in Claude Desktop config instead

3. **Build Status** ✅
   - MCP Gateway CLI built: `/Users/thomasmacbookair/dev/mcp-gateway/packages/cli/dist/`
   - Vikunja MCP Server built: `/Users/thomasmacbookair/dev/mcp-gateway/examples/vikunja/dist/`

### Required: Configure Vikunja API Token

To complete the migration, you need to store your Vikunja API token in the OS keyring.

#### Option 1: Interactive Configuration (Recommended)

```bash
cd /Users/thomasmacbookair/dev/mcp-gateway
node packages/cli/dist/index.js configure
```

When prompted:
- **Service name**: `vikunja` (must match exactly)
- **User ID**: Your identifier (e.g., `your-username` or `default-user`)
- **API Token**: Your Vikunja API token (get from https://app.vikunja.cloud/user/settings/api-tokens)
- **Confirm**: Yes

The token will be securely stored in your macOS Keychain.

#### Option 2: Non-Interactive Configuration

```bash
export MCP_GATEWAY_TOKEN="your-vikunja-api-token-here"
node packages/cli/dist/index.js configure --service vikunja --user-id default-user --non-interactive
```

## Verification

### Step 1: Check Token Storage

```bash
node packages/cli/dist/index.js status
```

You should see:
- Service: mcp-gateway
- Storage: OS Keyring ✓
- Configured Users: 1 (or more)

### Step 2: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Relaunch Claude Desktop
3. The Vikunja MCP server should initialize automatically

### Step 3: Test Tools

In Claude Desktop, try:
```
Can you list my Vikunja projects?
```

Expected behavior:
- First request will create a session (automatic)
- Server will authenticate using the JWT token
- Vikunja API token will be retrieved from keyring
- Your projects should be listed

## How It Works

### Authentication Flow

```
Claude Desktop
    ↓ stdio
MCP Gateway Vikunja Server
    ├── Receives tool call
    ├── Creates/validates JWT session
    ├── Checks authorization scopes
    ├── Retrieves Vikunja API token from macOS Keychain
    ├── Makes authenticated API call to Vikunja
    └── Returns result
```

### Security Features Now Active

- ✅ **JWT Authentication**: All tool calls require valid JWT token
- ✅ **Session Management**: 24-hour session expiry
- ✅ **Scope Authorization**: Tools require specific scopes (read/write/delete)
- ✅ **Rate Limiting**: 60 requests/minute per user
- ✅ **Audit Logging**: All actions logged to stderr
- ✅ **Secure Token Storage**: Vikunja API token in macOS Keychain (AES-256 encrypted)

## Troubleshooting

### "Vikunja API token not configured"

Run the configuration command above. The token must be stored with service name `vikunja`.

### "MCP_JWT_SECRET environment variable is required"

This should already be set in your Claude Desktop config. Verify:
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | grep MCP_JWT_SECRET
```

### Keyring Access Denied

Unlock your macOS Keychain:
```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

### Server Won't Start

Check the Claude Desktop logs for errors. The server logs to stderr, which Claude Desktop captures.

## Next Steps

1. Configure your Vikunja API token (see above)
2. Restart Claude Desktop
3. Test the integration with: "List my Vikunja projects"
4. All 21 tools should be functional with full security

## Available Tools (After Token Configuration)

### Read Operations (vikunja:read)
- vikunja_list_projects
- vikunja_get_project
- vikunja_list_tasks
- vikunja_get_task
- vikunja_list_tasks_in_view
- vikunja_list_buckets
- vikunja_list_task_comments
- vikunja_get_next_task

### Write Operations (vikunja:write)
- vikunja_create_project
- vikunja_update_project
- vikunja_create_task
- vikunja_update_task
- vikunja_create_bucket
- vikunja_update_bucket
- vikunja_add_task_comment
- vikunja_claim_task
- vikunja_complete_task_with_summary
- vikunja_add_task_checkpoint
- vikunja_release_task

### Delete Operations (vikunja:write + vikunja:delete)
- vikunja_delete_project
- vikunja_delete_task
- vikunja_delete_bucket

## References

- [Vikunja MCP Server README](./README.md)
- [Security Configuration Guide](./SECURITY_CONFIG.md)
- [MCP Gateway Documentation](../../docs/)
- [Get Vikunja API Token](https://app.vikunja.cloud/user/settings/api-tokens)
