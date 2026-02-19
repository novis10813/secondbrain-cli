import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';
import { ConfigManager } from '../utils/config.js';
import { TemplateManager } from '../utils/template.js';

export function createTemplateCommand(): Command {
    const command = new Command('template')
        .description('Manage note templates and their configurations');

    command
        .command('list')
        .description('List all available templates')
        .action(async () => {
            await withVault(async (vault) => {
                const templateManager = new TemplateManager(vault.config);
                const templates = templateManager.listTemplates();

                if (templates.length === 0) {
                    console.log('No templates found.');
                } else {
                    console.log('Available templates:');
                    templates.forEach(t => console.log(`- ${t}`));
                }
            });
        });

    command
        .command('get')
        .description('Get configuration for a template')
        .argument('<name>', 'Template name')
        .action(async (name) => {
            await withVault(async (vault) => {
                const configManager = new ConfigManager(vault.config.vaultPath);
                const templateConfig = configManager.getTemplateConfig(name);

                if (!templateConfig) {
                    console.log(`No configuration found for template: ${name}`);
                    console.log('{}');
                } else {
                    console.log(JSON.stringify(templateConfig, null, 2));
                }
            });
        });

    command
        .command('set')
        .description('Set configuration for a template')
        .argument('<name>', 'Template name')
        .option('--folder <path>', 'Default folder for new notes created with this template')
        .action(async (name, options) => {
            await withVault(async (vault) => {
                const configManager = new ConfigManager(vault.config.vaultPath);
                const existing = configManager.getTemplateConfig(name) || {};

                if (options.folder !== undefined) {
                    existing.targetFolder = options.folder;
                }

                configManager.setTemplateConfig(name, existing);
                console.log(`✅ Configuration updated for template: ${name}`);
                console.log(JSON.stringify(existing, null, 2));
            });
        });

    return command;
}
