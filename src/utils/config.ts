import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { Config, TemplateConfig } from '../types/index.js';

const CONFIG_FILE = '.secondbrain/config.json';
const DB_FILE = '.secondbrain/index.db';

export class ConfigManager {
  private vaultPath: string;

  constructor(vaultPath: string = process.cwd()) {
    this.vaultPath = vaultPath;
  }

  get configPath(): string {
    return join(this.vaultPath, CONFIG_FILE);
  }

  get dbPath(): string {
    return join(this.vaultPath, DB_FILE);
  }

  isInitialized(): boolean {
    return existsSync(this.configPath);
  }

  init(): Config {
    // Create .secondbrain directory
    const sbDir = join(this.vaultPath, '.secondbrain');
    if (!existsSync(sbDir)) {
      mkdirSync(sbDir, { recursive: true });
    }

    // Create default config
    const config: Config = {
      vaultPath: this.vaultPath,
      dailyNotesFolder: 'Daily',
      templatesFolder: 'Templates',
      dbPath: this.dbPath
    };

    this.saveConfig(config);
    return config;
  }

  loadConfig(): Config | null {
    if (!this.isInitialized()) {
      return null;
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content) as Config;
    } catch {
      return null;
    }
  }

  saveConfig(config: Config): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  getConfig(): Config {
    const config = this.loadConfig();
    if (!config) {
      throw new Error('Vault not initialized. Run `sb init` first.');
    }
    return config;
  }

  updateConfig(updates: Partial<Config>): void {
    const config = this.getConfig();
    Object.assign(config, updates);
    this.saveConfig(config);
  }

  getTemplateConfig(name: string): TemplateConfig | undefined {
    const config = this.getConfig();
    return config.templates?.[name];
  }

  setTemplateConfig(name: string, templateConfig: TemplateConfig): void {
    const config = this.getConfig();
    if (!config.templates) {
      config.templates = {};
    }
    config.templates[name] = templateConfig;
    this.saveConfig(config);
  }

  static findVaultPath(startPath: string = process.cwd()): string | null {
    let currentPath = startPath;

    while (currentPath !== dirname(currentPath)) {
      if (existsSync(join(currentPath, '.secondbrain', 'config.json'))) {
        return currentPath;
      }
      currentPath = dirname(currentPath);
    }

    return null;
  }
}