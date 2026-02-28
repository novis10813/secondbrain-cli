import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';
import { NoteParser } from '../utils/parser.js';

export function createGetCommand(): Command {
  const command = new Command('get')
    .description('Get a note by path or ID')
    .argument('<path-or-id>', 'File path (e.g. note.md or folder/note.md) or basename')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (pathOrId, options) => {
      await withVault(async (vault) => {
        let file = vault.resolvePathOrBasename(pathOrId);
        let resolvedPath = file?.path ?? null;

        // Auto-sync fallback: if not found in index, sync and retry once.
        // Handles cases where files were added or moved outside the CLI.
        if (!resolvedPath) {
          await vault.sync();
          file = vault.resolvePathOrBasename(pathOrId);
          resolvedPath = file?.path ?? null;
        }

        if (!resolvedPath) {
          throw new Error('Note not found');
        }

        const content = vault.readNote(resolvedPath);
        if (content === null) {
          throw new Error('File not found on disk');
        }

          const parsed = NoteParser.parse(content);
          const cache = file ? vault.getFileCache(file) : null;

          if (options.format === 'json') {
            console.log(JSON.stringify({
              path: resolvedPath,
              title: parsed.title,
              content: parsed.content,
              frontmatter: parsed.frontmatter,
              tags: parsed.tags.map(t => t.name),
              links: cache?.links?.map(l => l.link) ?? [],
              headings: parsed.headings
            }, null, 2));
          } else {
            console.log(parsed.title);
            console.log('─'.repeat(40));
            console.log(parsed.content);
          }
      });
    });

  return command;
}
