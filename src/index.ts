#!/usr/bin/env bun

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createVaultCommand } from './commands/vault.js';
import { createCaptureCommand } from './commands/capture.js';
import { createSearchCommand } from './commands/search.js';
import { createGetCommand } from './commands/get.js';
import { createBacklinksCommand } from './commands/backlinks.js';
import { createOutlinksCommand } from './commands/outlinks.js';
import { createOpenCommand } from './commands/open.js';
import { createSyncCommand } from './commands/sync.js';
import { createStatsCommand } from './commands/stats.js';
import { createOrphansCommand } from './commands/orphans.js';
import { createConfigCommand } from './commands/config.js';
import { createMigrateCommand } from './commands/migrate.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

// Resolve package.json relative to the entry script (works for dist/index.js and bun run src/index.ts)
const entryDir = dirname(process.argv[1] ?? '');
const pkg = JSON.parse(
  readFileSync(join(entryDir, '..', 'package.json'), 'utf-8')
) as { version: string };

const program = new Command();

program
  .name('sb')
  .description('SecondBrain CLI - A tool for LLM agents to manage Obsidian vaults')
  .version(pkg.version);

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createVaultCommand());
program.addCommand(createCaptureCommand());
program.addCommand(createSearchCommand());
program.addCommand(createGetCommand());
program.addCommand(createBacklinksCommand());
program.addCommand(createOutlinksCommand());
program.addCommand(createOpenCommand());
program.addCommand(createSyncCommand());
program.addCommand(createStatsCommand());
program.addCommand(createOrphansCommand());
program.addCommand(createConfigCommand());
program.addCommand(createMigrateCommand());

// Default action - show help
if (process.argv.length === 2) {
  program.help();
}

program.parse();
