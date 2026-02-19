import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';
import { NoteParser } from '../utils/parser.js';

export function createCaptureCommand(): Command {
  const command = new Command('capture')
    .description('Capture a new note')
    .argument('<content>', 'Note content')
    .option('-t, --title <title>', 'Note title')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--template <template>', 'Template name')
    .option('--path <path>', 'Custom file path')
    .action(async (content, options) => {
      const body = content ?? '';
      await withVault(async (vault) => {
          let notePath: string;
          let noteContent: string;
          let frontmatter: Record<string, unknown> = {};

          const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];

          if (options.template) {
            const templatePath = vault.getTemplatePath(options.template);
            const templateContent = vault.readNote(templatePath);
            if (templateContent) {
              const parsed = NoteParser.parse(templateContent);
              frontmatter = parsed.frontmatter;
              if (parsed.tags.length > 0) {
                tags.push(...parsed.tags.map(t => t.name));
              }
            }
          }

          const title = options.title || new Date().toISOString();

          if (options.path) {
            notePath = options.path.endsWith('.md') ? options.path : `${options.path}.md`;
          } else {
            const safeTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            notePath = `${safeTitle}.md`;
          }

          frontmatter.tags = [...new Set(tags)];
          noteContent = NoteParser.generateNoteContent(title, body, frontmatter);

          vault.writeNote(notePath, noteContent);

          // Index the new file by syncing (will only process changed files)
          await vault.sync();

          const file = vault.getFileByPath(notePath);

          console.log('✅ Note captured!');
          console.log('Path:', notePath);
          console.log(JSON.stringify({
            success: true,
            path: notePath,
            basename: file?.basename ?? notePath.replace(/\.md$/, ''),
            title,
            tags
          }, null, 2));
      });
    });

  return command;
}
