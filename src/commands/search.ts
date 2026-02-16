import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createSearchCommand(): Command {
  const command = new Command('search')
    .description('Search notes')
    .argument('<query>', 'Search query')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('-l, --limit <limit>', 'Maximum results', '20')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action((query, options) => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;
        const limit = parseInt(options.limit);

        const notes = vault.searchNotes(query, tags, limit);

        if (options.format === 'json') {
          const results = notes.map(note => ({
            id: note.id,
            title: note.title,
            path: note.path,
            excerpt: note.content.substring(0, 200) + (note.content.length > 200 ? '...' : ''),
            tags: note.tags,
            linksCount: note.links.length,
            backlinksCount: note.backlinks.length
          }));

          console.log(JSON.stringify({
            query,
            filters: { tags, limit },
            results,
            total: results.length
          }, null, 2));
        } else {
          // Text format
          console.log(`Search results for "${query}":\n`);
          notes.forEach((note, i) => {
            console.log(`${i + 1}. ${note.title}`);
            console.log(`   Path: ${note.path}`);
            console.log(`   Tags: ${note.tags.join(', ') || 'none'}`);
            console.log(`   ID: ${note.id}`);
            console.log();
          });
        }

        vault.close();
      } catch (error) {
        console.error('❌ Search failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
