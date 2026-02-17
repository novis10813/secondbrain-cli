import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';
import { NoteParser } from '../utils/parser.js';

export function createGetCommand(): Command {
  const command = new Command('get')
    .description('Get a note by path or ID')
    .argument('<path-or-id>', 'File path (e.g. note.md or folder/note.md) or basename')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (pathOrId, options) => {
      try {
        await withVault((vault) => {
          const file = vault.resolvePathOrBasename(pathOrId);
          const resolvedPath = file?.path ?? null;
          if (!resolvedPath) {
            console.error('❌ Note not found');
            process.exit(1);
          }

          const content = vault.readNote(resolvedPath);
          if (content === null) {
            console.error('❌ File not found on disk');
            process.exit(1);
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
      } catch (error) {
        console.error('❌ Failed to get note:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
