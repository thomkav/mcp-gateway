import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { TokenVault } from '@mcp-gateway/core/storage';
import { SessionManager } from '@mcp-gateway/core/session';

export const rotateCommand = new Command('rotate')
  .description('Rotate sessions and optionally update tokens')
  .option('-s, --service <name>', 'Service name', 'mcp-gateway')
  .option('-u, --user-id <id>', 'User ID to rotate sessions for (required)')
  .option('--update-token', 'Also update the API token')
  .option('--destroy-all', 'Destroy all existing sessions before creating new one')
  .option('--non-interactive', 'Run in non-interactive mode')
  .action(async (options) => {
    try {
      if (!options.userId) {
        console.error(chalk.red('Error: --user-id is required'));
        process.exit(1);
      }

      const serviceName = options.service;
      const userId = options.userId;

      console.log(chalk.blue.bold('\n🔄 Session Rotation\n'));

      const vault = new TokenVault({
        serviceName: serviceName,
        fallbackToMemory: true,
      });

      // Check if token exists
      const key = `${serviceName}:${userId}`;
      const tokenExists = await vault.exists(key);

      if (!tokenExists) {
        console.error(
          chalk.red(`\n❌ No token configured for ${serviceName}:${userId}`)
        );
        console.log(chalk.dim('Run'), chalk.white('mcp-gateway configure'), chalk.dim('first\n'));
        process.exit(1);
      }

      // Confirm action in interactive mode
      if (!options.nonInteractive) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: options.destroyAll
              ? 'This will destroy ALL sessions and create a new one. Continue?'
              : 'This will rotate the session. Continue?',
            default: true,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('\n⚠️  Rotation cancelled\n'));
          return;
        }
      }

      // Create session manager (in production, this would connect to actual session store)
      const sessionManager = new SessionManager({
        sessionExpiryMs: 3600000, // 1 hour
      });

      const spinner = ora('Processing session rotation...').start();

      try {
        // Get existing sessions
        const existingSessions = sessionManager.getUserSessions(userId);

        let destroyedCount = 0;
        if (options.destroyAll) {
          // Destroy all existing sessions
          destroyedCount = sessionManager.destroyUserSessions(userId);
          spinner.text = `Destroyed ${destroyedCount} session(s)...`;
        }

        // Create new session
        const newSession = sessionManager.createSession(userId, {
          rotatedAt: new Date().toISOString(),
          previousSessionCount: existingSessions.length,
        });

        spinner.succeed(chalk.green('Session rotation complete!'));

        console.log(chalk.green('\n✅ Rotation successful!\n'));
        console.log(chalk.dim('Service:'), serviceName);
        console.log(chalk.dim('User ID:'), userId);

        if (options.destroyAll) {
          console.log(chalk.dim('Destroyed Sessions:'), destroyedCount);
        }

        console.log(chalk.dim('\nNew Session:'));
        console.log(chalk.dim('  Session ID:'), chalk.white(newSession.sessionId));
        console.log(chalk.dim('  Created:'), chalk.white(newSession.createdAt.toISOString()));
        console.log(chalk.dim('  Expires:'), chalk.white(newSession.expiresAt.toISOString()));

        // Handle token update if requested
        if (options.updateToken) {
          if (options.nonInteractive) {
            const newToken = process.env.MCP_GATEWAY_NEW_TOKEN;
            if (!newToken) {
              console.error(
                chalk.yellow(
                  '\n⚠️  MCP_GATEWAY_NEW_TOKEN environment variable not set. Token not updated.\n'
                )
              );
            } else {
              const tokenSpinner = ora('Updating token...').start();
              await vault.store(key, newToken);
              tokenSpinner.succeed(chalk.green('Token updated successfully!'));
            }
          } else {
            const { newToken } = await inquirer.prompt([
              {
                type: 'password',
                name: 'newToken',
                message: 'Enter new API token:',
                mask: '*',
                validate: (input) => input.length > 0 || 'Token is required',
              },
            ]);

            const tokenSpinner = ora('Updating token...').start();
            await vault.store(key, newToken);
            tokenSpinner.succeed(chalk.green('Token updated successfully!'));
          }
        }

        console.log(); // Empty line

        // Cleanup
        sessionManager.destroy();
      } catch (error) {
        spinner.fail(chalk.red('Session rotation failed'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Rotation failed:'), error);
      process.exit(1);
    }
  });
