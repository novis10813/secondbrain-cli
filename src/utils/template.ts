import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import type { Config } from '../types/index.js';

export class TemplateManager {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private getTemplatePath(name: string): string {
    return join(this.config.vaultPath, this.config.templatesFolder, `${name}.md`);
  }

  private ensureTemplatesDir(): void {
    const templatesDir = join(this.config.vaultPath, this.config.templatesFolder);
    if (!existsSync(templatesDir)) {
      mkdirSync(templatesDir, { recursive: true });
    }
  }

  createTemplate(name: string, content: string): void {
    this.ensureTemplatesDir();
    const templatePath = this.getTemplatePath(name);
    writeFileSync(templatePath, content, 'utf-8');
  }

  getTemplate(name: string): string | null {
    const templatePath = this.getTemplatePath(name);
    if (!existsSync(templatePath)) {
      return null;
    }
    return readFileSync(templatePath, 'utf-8');
  }

  listTemplates(): string[] {
    const templatesDir = join(this.config.vaultPath, this.config.templatesFolder);
    if (!existsSync(templatesDir)) {
      return [];
    }

    const entries = readdirSync(templatesDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
      .map(entry => entry.name.replace('.md', ''));
  }

  deleteTemplate(name: string): void {
    const templatePath = this.getTemplatePath(name);
    if (!existsSync(templatePath)) {
      throw new Error(`Template '${name}' not found`);
    }
    unlinkSync(templatePath);
  }

  renderTemplate(name: string, variables: Record<string, string>): string {
    const template = this.getTemplate(name);
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }

    // Replace all {{variable}} with values
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, value);
    }

    // Replace any remaining placeholders with empty string
    const remainingRegex = /\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/g;
    result = result.replace(remainingRegex, '');

    return result;
  }

  validateTemplate(name: string): string[] {
    const template = this.getTemplate(name);
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }

    const variables = new Set<string>();
    const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  insertTemplate(name: string, targetPath: string, variables: Record<string, string>): void {
    const rendered = this.renderTemplate(name, variables);
    const fullPath = join(this.config.vaultPath, targetPath);

    // Ensure parent directory exists
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, rendered, 'utf-8');
  }

  getRequiredFields(name: string): string[] {
    return this.validateTemplate(name);
  }

  validateRequiredFields(name: string, provided: Record<string, string>): string[] {
    const required = this.getRequiredFields(name);
    const missing: string[] = [];

    for (const field of required) {
      if (!(field in provided) || provided[field] === undefined || provided[field] === '') {
        missing.push(field);
      }
    }

    return missing;
  }
}
