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
    .action(async (content, options) => {
      const body = content ?? '';
      await withVault(async (vault) => {
        let noteFolder = '';
        let noteContent: string;
        let frontmatter: Record<string, unknown> = {};

        const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];

        // 1. Resolve Template Folder
        if (options.template) {
          // Check config for template's targetFolder
          const templateConfig = vault.config.templates?.[options.template];
          if (templateConfig?.targetFolder) {
            noteFolder = templateConfig.targetFolder;
          }

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

        // 2. Resolve Default Capture Folder if no template folder
        if (!noteFolder && vault.config.captureFolder) {
          noteFolder = vault.config.captureFolder;
        }

        const title = options.title || new Date().toISOString();

        // Obsidian-friendly filename: replace illegal characters with '-'
        // Illegal: / \ : * ? " < > |
        const filename = `${title.replace(/[\/\x3a\x2a\x3f\x22\x3c\x3e\x7c]/g, '-')}.md`;
        const notePath = noteFolder ? (noteFolder.endsWith('/') ? `${noteFolder}${filename}` : `${noteFolder}/${filename}`) : filename;

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
          basename: file?.basename ?? notePath.replace(/\.md$/, '').split('/').pop(),
          title,
          tags
        }, null, 2));
      });
    });

  return command;
}
