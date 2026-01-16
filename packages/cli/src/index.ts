#!/usr/bin/env node

import { Command } from 'commander';
import { configureCommand } from './commands/configure.js';
import { statusCommand } from './commands/status.js';
import { rotateCommand } from './commands/rotate.js';

const program = new Command();

program
  .name('mcp-gateway')
  .description('CLI tool for MCP Gateway management')
  .version('1.0.0');

// Add commands
program.addCommand(configureCommand);
program.addCommand(statusCommand);
program.addCommand(rotateCommand);

program.parse();
