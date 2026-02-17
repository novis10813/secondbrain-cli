import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';

/** Parse --modified-after / --modified-before value to unix ms. ISO 8601 or digits (ms). */
export function parseDateOption(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const s = String(value).trim();
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : undefined;
}

export function createSearchCommand(): Command {
  const command = new Command('search')
    .description('Search notes by path/basename and tags')
    .argument('[query]', 'Search query (path/basename); omit for tag-only or path-only search', '')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('-p, --path <pathPrefix>', 'Restrict to files under this path prefix (e.g. Daily/ or Projects)')
    .option('-l, --limit <limit>', 'Maximum results', '20')
    .option('--links-to <path>', 'Only files that link to this path or basename')
    .option('--heading <text>', 'Only files that contain a heading matching this text')
    .option('--modified-after <date>', 'Only files modified after date (ISO 8601 or unix ms)')
    .option('--modified-before <date>', 'Only files modified before date (ISO 8601 or unix ms)')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (query, options) => {
      await withVault((vault) => {
        const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;
        const limit = parseInt(options.limit);
        const pathPrefix = options.path?.trim() || undefined;
        const headingQuery = options.heading?.trim() || undefined;
        const modifiedAfter = parseDateOption(options.modifiedAfter);
        const modifiedBefore = parseDateOption(options.modifiedBefore);
        let linksToPath: string | undefined;
        if (options.linksTo?.trim()) {
          const file = vault.resolvePathOrBasename(options.linksTo.trim());
          linksToPath = file?.path ?? undefined;
          if (!linksToPath) {
            throw new Error(`Note not found for --links-to: ${options.linksTo.trim()}`);
          }
        }

        const results = vault.searchFiles(
          query ?? '', tags, limit, pathPrefix, linksToPath, headingQuery, modifiedAfter, modifiedBefore
        );

        if (options.format === 'json') {
          const output = results.map(({ file, tags: fileTags }) => ({
            path: file.path,
            basename: file.basename,
            tags: fileTags
          }));
          console.log(JSON.stringify({
            query: query ?? '',
            filters: {
              tags,
              limit,
              path: pathPrefix,
              linksTo: linksToPath,
              heading: headingQuery,
              modifiedAfter: modifiedAfter ?? undefined,
              modifiedBefore: modifiedBefore ?? undefined
            },
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
      });
    });

  return command;
}
