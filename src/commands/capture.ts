import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';
import { NoteParser } from '../utils/parser.js';
import { TemplateManager } from '../utils/template.js';

export function createCaptureCommand(): Command {
  const command = new Command('capture')
    .description('Capture a new note')
    .argument('<content>', 'Note content')
    .option('-t, --title <title>', 'Note title')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--template <template>', 'Template name')
    .option('--var <entries...>', 'Template variables (key=value)')
    .action(async (content, options) => {
      const body = content ?? '';
      await withVault(async (vault) => {
        let noteFolder = '';
        let noteContent: string;
        let frontmatter: Record<string, unknown> = {};
        const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];

        // Parse --var key=value entries
        const vars: Record<string, string> = {};
        if (options.var) {
          options.var.forEach((entry: string) => {
            const [key, ...valueParts] = entry.split('=');
            if (key) {
              vars[key] = valueParts.join('=');
            }
          });
        }

        // 1. Resolve Template
        if (options.template) {
          const templateConfig = vault.config.templates?.[options.template];
          if (templateConfig?.targetFolder) {
            noteFolder = templateConfig.targetFolder;
          }

          const templateManager = new TemplateManager(vault.config);
          const templateContent = templateManager.getTemplate(options.template);

          if (templateContent) {
            // Extract metadata from template for merging
            const parsed = NoteParser.parse(templateContent);
            frontmatter = parsed.frontmatter;
            if (parsed.tags.length > 0) {
              tags.push(...parsed.tags.map(t => t.name));
            }

            // Placeholder logic
            const placeholders = templateManager.validateTemplate(options.template);
            const variables = { content: body, ...vars };

            // Built-in placeholders are handled by processPlaceholders automatically
            const BUILTIN_PLACEHOLDERS = new Set(['TITLE', 'UUID', 'DATE', 'TIME', 'VAULT']);

            // Check for missing variables and warn (skip built-in placeholders)
            placeholders.forEach(p => {
              if (!BUILTIN_PLACEHOLDERS.has(p) && !(p in variables)) {
                console.warn(`⚠️ Warning: Template placeholder '{{${p}}}' has no value provided, using empty string.`);
              }
            });

            // Check if content is provided but no {{content}} placeholder exists
            if (body && !placeholders.includes('content')) {
              console.warn(`⚠️ Warning: Note content was provided but no '{{content}}' placeholder exists in template '${options.template}'. Content will be ignored.`);
            }

            noteContent = templateManager.renderTemplate(options.template, variables, {
              title: options.title,
              vault: vault.config.vaultPath.split('/').pop(),
              date: new Date(),
            });
          } else {
            // Fallback if template file not found
            const title = options.title || new Date().toISOString();
            frontmatter.tags = [...new Set(tags)];
            noteContent = NoteParser.generateNoteContent(title, body, frontmatter);
          }
        } else {
          // No template: use default generator
          const title = options.title || new Date().toISOString();
          frontmatter.tags = [...new Set(tags)];
          noteContent = NoteParser.generateNoteContent(title, body, frontmatter);
        }

        // 2. Resolve Default Capture Folder if no template folder
        if (!noteFolder && vault.config.captureFolder) {
          noteFolder = vault.config.captureFolder;
        }

        const title = options.title || new Date().toISOString();

        // Obsidian-friendly filename
        const filename = `${title.replace(/[\/\x3a\x2a\x3f\x22\x3c\x3e\x7c]/g, '-')}.md`;
        const notePath = noteFolder ? (noteFolder.endsWith('/') ? `${noteFolder}${filename}` : `${noteFolder}/${filename}`) : filename;

        // If not using template, frontmatter.tags was already set. 
        // If using template, renderTemplate already produced full content.
        // BUT we might want to update frontmatter tags for non-template case.
        // The current logic above handles this.

        vault.writeNote(notePath, noteContent);
        vault.indexSingleFile(notePath);

        const file = vault.getFileByPath(notePath);

        console.log('✅ Note captured!');
        console.log('Path:', notePath);
        console.log(JSON.stringify({
          success: true,
          path: notePath,
          basename: file?.basename ?? notePath.replace(/\.md$/, '').split('/').pop(),
          title,
          tags: [...new Set(tags)]
        }, null, 2));
      });
    });

  return command;
}
