import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { TokenVault } from '@mcp-gateway/core/storage';
import { SessionManager } from '@mcp-gateway/core/session';

export const statusCommand = new Command('status')
  .description('Show security status and service information')
  .option('-s, --service <name>', 'Service name to check', 'mcp-gateway')
  .option('-u, --user-id <id>', 'User ID to check status for')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const serviceName = options.service;
      const userId = options.userId;

      const vault = new TokenVault({
        serviceName: serviceName,
        fallbackToMemory: true,
      });

      const status: any = {
        service: serviceName,
        storage: vault.isUsingKeyring() ? 'keyring' : 'memory',
        timestamp: new Date().toISOString(),
      };

      // Check if token exists for user
      if (userId) {
        const spinner = ora('Checking token status...').start();
        const key = `${serviceName}:${userId}`;
        const tokenExists = await vault.exists(key);
        spinner.stop();

        status.userId = userId;
        status.tokenConfigured = tokenExists;

        if (tokenExists) {
          // Try to verify token if we can create a session manager
          const sessionManager = new SessionManager({
            sessionExpiryMs: 3600000, // 1 hour
          });

          const activeSessions = sessionManager.getUserSessions(userId);
          status.activeSessions = activeSessions.length;
          status.sessions = activeSessions.map((s) => ({
            sessionId: s.sessionId,
            createdAt: s.createdAt.toISOString(),
            expiresAt: s.expiresAt.toISOString(),
          }));

          // Cleanup
          sessionManager.destroy();
        }
      } else {
        // Show general status
        const memoryKeys = vault.listKeys();
        status.configuredUsers = memoryKeys.length;

        if (memoryKeys.length > 0) {
          status.users = memoryKeys.map((key) => {
            const [service, user] = key.split(':');
            return { service, userId: user };
          });
        }
      }

      // Output
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(chalk.blue.bold('\n🔐 MCP Gateway Status\n'));
        console.log(chalk.dim('Service:'), chalk.white(status.service));
        console.log(chalk.dim('Storage:'), status.storage === 'keyring' ? chalk.green('OS Keyring ✓') : chalk.yellow('Memory (fallback)'));
        console.log(chalk.dim('Timestamp:'), chalk.white(status.timestamp));

        if (userId) {
          console.log(chalk.dim('\nUser ID:'), chalk.white(status.userId));
          console.log(
            chalk.dim('Token Status:'),
            status.tokenConfigured ? chalk.green('Configured ✓') : chalk.red('Not configured ✗')
          );

          if (status.activeSessions !== undefined) {
            console.log(chalk.dim('Active Sessions:'), chalk.white(status.activeSessions));

            if (status.sessions && status.sessions.length > 0) {
              console.log(chalk.dim('\nSessions:'));
              status.sessions.forEach((session: any, idx: number) => {
                console.log(chalk.dim(`  ${idx + 1}.`), chalk.white(session.sessionId));
                console.log(chalk.dim('     Created:'), chalk.white(session.createdAt));
                console.log(chalk.dim('     Expires:'), chalk.white(session.expiresAt));
              });
            }
          }
        } else {
          console.log(chalk.dim('\nConfigured Users:'), chalk.white(status.configuredUsers || 0));

          if (status.users && status.users.length > 0) {
            console.log(chalk.dim('\nUsers:'));
            status.users.forEach((user: any, idx: number) => {
              console.log(
                chalk.dim(`  ${idx + 1}.`),
                chalk.white(`${user.service}:${user.userId}`)
              );
            });
          }

          if (status.storage === 'keyring') {
            console.log(
              chalk.yellow(
                '\n⚠️  Note: User list only shows memory store. Keyring may have additional entries.\n'
              )
            );
          }
        }

        console.log(); // Empty line
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Status check failed:'), error);
      process.exit(1);
    }
  });
