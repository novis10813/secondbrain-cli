#!/usr/bin/env node

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createCaptureCommand } from './commands/capture.js';
import { createSearchCommand } from './commands/search.js';
import { createGetCommand } from './commands/get.js';
import { createBacklinksCommand } from './commands/backlinks.js';
import { createSyncCommand } from './commands/sync.js';
import { createStatsCommand } from './commands/stats.js';
import { createOrphansCommand } from './commands/orphans.js';
import { createConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('sb')
  .description('SecondBrain CLI - A tool for LLM agents to manage Obsidian vaults')
  .version('0.1.0');

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createCaptureCommand());
program.addCommand(createSearchCommand());
program.addCommand(createGetCommand());
program.addCommand(createBacklinksCommand());
program.addCommand(createSyncCommand());
program.addCommand(createStatsCommand());
program.addCommand(createOrphansCommand());
program.addCommand(createConfigCommand());

// Default action - show help
if (process.argv.length === 2) {
  program.help();
}

program.parse();
