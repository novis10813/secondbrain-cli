import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';
import { NoteParser } from '../utils/parser.js';
import { join } from 'path';

export function createCaptureCommand(): Command {
  const command = new Command('capture')
    .description('Capture a new note')
    .argument('<content>', 'Note content')
    .option('-t, --title <title>', 'Note title')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--template <template>', 'Template name')
    .option('--path <path>', 'Custom file path')
    .action(async (content, options) => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        let notePath: string;
        let noteContent: string;
        let frontmatter: Record<string, unknown> = {};

        // Handle tags
        const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
        
        // Handle template
        if (options.template) {
          const templatePath = vault.getTemplatePath(options.template);
          const templateContent = vault.readNote(templatePath);
          
          if (templateContent) {
            const parsed = NoteParser.parse(templateContent);
            frontmatter = parsed.frontmatter;
            // Merge tags
            if (parsed.tags.length > 0) {
              tags.push(...parsed.tags);
            }
          }
        }

        // Determine title
        const title = options.title || new Date().toISOString();

        // Determine path
        if (options.path) {
          notePath = options.path.endsWith('.md') ? options.path : `${options.path}.md`;
        } else {
          // Default: use title as filename
          const safeTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
          notePath = `${safeTitle}.md`;
        }

        // Generate content
        frontmatter.tags = [...new Set(tags)]; // Remove duplicates
        noteContent = NoteParser.generateNoteContent(title, content, frontmatter);

        // Write note
        vault.writeNote(notePath, noteContent);

        // Sync to database
        await vault.sync();

        const note = vault.getNoteByPath(notePath);
        
        console.log('✅ Note captured!');
        console.log('Path:', notePath);
        if (note) {
          console.log('ID:', note.id);
          console.log(JSON.stringify({
            success: true,
            id: note.id,
            path: notePath,
            title,
            tags
          }, null, 2));
        }

        vault.close();
      } catch (error) {
        console.error('❌ Failed to capture note:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
