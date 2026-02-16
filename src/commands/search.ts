import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createSearchCommand(): Command {
  const command = new Command('search')
    .description('Search notes by path/basename and tags')
    .argument('[query]', 'Search query (path/basename); omit for tag-only or path-only search', '')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('-p, --path <pathPrefix>', 'Restrict to files under this path prefix (e.g. Daily/ or Projects)')
    .option('-l, --limit <limit>', 'Maximum results', '20')
    .option('--links-to <path>', 'Only files that link to this path or basename')
    .option('--heading <text>', 'Only files that contain a heading matching this text')
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
        const pathPrefix = options.path?.trim() || undefined;
        const headingQuery = options.heading?.trim() || undefined;
        let linksToPath: string | undefined;
        if (options.linksTo?.trim()) {
          const file = vault.resolvePathOrBasename(options.linksTo.trim());
          linksToPath = file?.path ?? undefined;
          if (!linksToPath) {
            console.error(`❌ Note not found for --links-to: ${options.linksTo.trim()}`);
            process.exit(1);
          }
        }

        const results = vault.searchFiles(
          query ?? '', tags, limit, pathPrefix, linksToPath, headingQuery
        );

        if (options.format === 'json') {
          const output = results.map(({ file, tags: fileTags }) => ({
            path: file.path,
            basename: file.basename,
            tags: fileTags
          }));

          console.log(JSON.stringify({
            query: query ?? '',
            filters: { tags, limit, path: pathPrefix, linksTo: linksToPath, heading: headingQuery },
            results: output,
            total: output.length
          }, null, 2));
        } else {
          console.log(`Search results for "${query}":\n`);
          results.forEach(({ file, tags: fileTags }, i) => {
            console.log(`${i + 1}. ${file.basename}`);
            console.log(`   Path: ${file.path}`);
            console.log(`   Tags: ${fileTags.join(', ') || 'none'}`);
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
