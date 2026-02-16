import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';
import { NoteParser } from '../utils/parser.js';

export function createGetCommand(): Command {
  const command = new Command('get')
    .description('Get a note by path or ID')
    .argument('<path-or-id>', 'File path (e.g. note.md or folder/note.md) or note ID')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action((pathOrId, options) => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        // Resolve path: try as path first, then as note ID
        let resolvedPath: string | null = null;
        const asPath = pathOrId.includes('/') || pathOrId.endsWith('.md')
          ? pathOrId
          : pathOrId + '.md';
        const file = vault.getFileByPath(pathOrId) ?? vault.getFileByPath(asPath);
        if (file) {
          resolvedPath = file.path;
        } else {
          const note = vault.getNoteById(pathOrId);
          if (note) resolvedPath = note.path;
        }

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
        const fileInfo = vault.getFileByPath(resolvedPath);
        const cache = fileInfo ? vault.getFileCache(fileInfo) : null;

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

        vault.close();
      } catch (error) {
        console.error('❌ Failed to get note:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
