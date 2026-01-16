import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { TokenVault } from '@mcp-gateway/core/storage';

export const configureCommand = new Command('configure')
  .description('Configure MCP Gateway with interactive token setup')
  .option('-s, --service <name>', 'Service name for the configuration')
  .option('-u, --user-id <id>', 'User ID for the token')
  .option('--non-interactive', 'Run in non-interactive mode (requires all options)')
  .action(async (options) => {
    try {
      let serviceName = options.service;
      let userId = options.userId;
      let token: string;

      // Interactive mode
      if (!options.nonInteractive) {
        console.log(chalk.blue.bold('\n🔐 MCP Gateway Configuration\n'));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'serviceName',
            message: 'Service name:',
            default: serviceName || 'mcp-gateway',
            validate: (input) => input.length > 0 || 'Service name is required',
          },
          {
            type: 'input',
            name: 'userId',
            message: 'User ID:',
            default: userId || 'default-user',
            validate: (input) => input.length > 0 || 'User ID is required',
          },
          {
            type: 'password',
            name: 'token',
            message: 'API Token (will be stored securely in OS keyring):',
            mask: '*',
            validate: (input) => input.length > 0 || 'Token is required',
          },
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Save this configuration?',
            default: true,
          },
        ]);

        if (!answers.confirm) {
          console.log(chalk.yellow('\n⚠️  Configuration cancelled\n'));
          return;
        }

        serviceName = answers.serviceName;
        userId = answers.userId;
        token = answers.token;
      } else {
        // Non-interactive mode validation
        if (!serviceName || !userId) {
          console.error(
            chalk.red('Error: --service and --user-id are required in non-interactive mode')
          );
          process.exit(1);
        }

        // In non-interactive mode, token must be provided via stdin or env var
        token = process.env.MCP_GATEWAY_TOKEN || '';
        if (!token) {
          console.error(
            chalk.red('Error: MCP_GATEWAY_TOKEN environment variable is required in non-interactive mode')
          );
          process.exit(1);
        }
      }

      // Store the token
      const spinner = ora('Storing token securely...').start();

      const vault = new TokenVault({
        serviceName: serviceName,
        fallbackToMemory: false, // For CLI, we want to ensure keyring is used
      });

      const key = `${serviceName}:${userId}`;
      const success = await vault.store(key, token);

      if (success) {
        spinner.succeed(chalk.green('Token stored successfully!'));

        console.log(chalk.green('\n✅ Configuration complete!\n'));
        console.log(chalk.dim('Service:'), serviceName);
        console.log(chalk.dim('User ID:'), userId);
        console.log(chalk.dim('Storage:'), vault.isUsingKeyring() ? 'OS Keyring' : 'Memory (fallback)');

        if (!vault.isUsingKeyring()) {
          console.log(
            chalk.yellow(
              '\n⚠️  Warning: Token stored in memory only. Keyring access failed.\n'
            )
          );
        }
      } else {
        spinner.fail(chalk.red('Failed to store token'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Configuration failed:'), error);
      process.exit(1);
    }
  });
