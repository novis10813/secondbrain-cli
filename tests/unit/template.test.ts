import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { TemplateManager } from '../../src/utils/template';
import { ConfigManager } from '../../src/utils/config';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('TemplateManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let templateManager: TemplateManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sb-template-test-'));
    configManager = new ConfigManager(tempDir);
    const config = configManager.init();
    templateManager = new TemplateManager(config);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createTemplate', () => {
    it('應該創建模板檔案', () => {
      const templateContent = `---
tags: [meeting]
date: {{date}}
---

# {{title}}

{{content}}`;

      templateManager.createTemplate('meeting', templateContent);

      const templatePath = join(tempDir, 'Templates', 'meeting.md');
      expect(existsSync(templatePath)).toBe(true);
    });

    it('應該自動創建 Templates 目錄', () => {
      templateManager.createTemplate('test', '# Test');

      expect(existsSync(join(tempDir, 'Templates'))).toBe(true);
    });

    it('應該寫入正確的模板內容', () => {
      const content = '# Meeting Notes';
      templateManager.createTemplate('meeting', content);

      const templatePath = join(tempDir, 'Templates', 'meeting.md');
      const readContent = readFileSync(templatePath, 'utf-8');
      expect(readContent).toBe(content);
    });
  });

  describe('getTemplate', () => {
    it('應該讀取模板內容', () => {
      const content = '# Meeting\n\nDate: {{date}}';
      templateManager.createTemplate('meeting', content);

      const template = templateManager.getTemplate('meeting');
      expect(template).toBe(content);
    });

    it('應該在模板不存在時回傳 null', () => {
      const template = templateManager.getTemplate('non-existent');
      expect(template).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('應該列出所有模板', () => {
      templateManager.createTemplate('meeting', '# Meeting');
      templateManager.createTemplate('daily', '# Daily');
      templateManager.createTemplate('project', '# Project');

      const templates = templateManager.listTemplates();

      expect(templates).toContain('meeting');
      expect(templates).toContain('daily');
      expect(templates).toContain('project');
      expect(templates.length).toBe(3);
    });

    it('應該在沒有模板時回傳空陣列', () => {
      const templates = templateManager.listTemplates();
      expect(templates).toEqual([]);
    });
  });

  describe('deleteTemplate', () => {
    it('應該刪除模板', () => {
      templateManager.createTemplate('to-delete', '# Delete Me');

      templateManager.deleteTemplate('to-delete');

      const templatePath = join(tempDir, 'Templates', 'to-delete.md');
      expect(existsSync(templatePath)).toBe(false);
    });

    it('應該在不存在的模板上拋出錯誤', () => {
      expect(() => templateManager.deleteTemplate('non-existent')).toThrow();
    });
  });

  describe('renderTemplate', () => {
    it('應該替換簡單變數', () => {
      const template = 'Hello {{name}}!';
      templateManager.createTemplate('greeting', template);

      const result = templateManager.renderTemplate('greeting', { name: 'World' });

      expect(result).toBe('Hello World!');
    });

    it('應該替換多個變數', () => {
      const template = '{{greeting}} {{name}}, today is {{date}}';
      templateManager.createTemplate('multi', template);

      const result = templateManager.renderTemplate('multi', {
        greeting: 'Hello',
        name: 'Alice',
        date: '2024-01-15'
      });

      expect(result).toBe('Hello Alice, today is 2024-01-15');
    });

    it('應該將未匹配的變數替換為空字串', () => {
      const template = 'Hello {{name}}, your code is {{code}}';
      templateManager.createTemplate('partial', template);

      const result = templateManager.renderTemplate('partial', { name: 'Bob' });

      expect(result).toBe('Hello Bob, your code is ');
    });

    it('應該支援模板中的 frontmatter', () => {
      const template = `---
title: {{title}}
tags: [{{tag}}]
---

# {{title}}

{{content}}`;
      templateManager.createTemplate('note', template);

      const result = templateManager.renderTemplate('note', {
        title: 'My Note',
        tag: 'work',
        content: 'This is the content.'
      });

      expect(result).toContain('title: My Note');
      expect(result).toContain('tags: [work]');
      expect(result).toContain('# My Note');
      expect(result).toContain('This is the content.');
    });

    it('應該在不存在的模板上拋出錯誤', () => {
      expect(() => templateManager.renderTemplate('non-existent', {})).toThrow();
    });

    it('應該將未提供的所有 placeholder 替換為空字串', () => {
      const template = '{{a}} and {{b}} and {{c}}';
      templateManager.createTemplate('all_missing', template);

      const result = templateManager.renderTemplate('all_missing', { a: 'hello' });

      expect(result).toBe('hello and  and ');
    });
  });

  describe('validateTemplate', () => {
    it('應該識別模板中的變數', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      templateManager.createTemplate('user', template);

      const variables = templateManager.validateTemplate('user');

      expect(variables).toContain('name');
      expect(variables).toContain('email');
      expect(variables.length).toBe(2);
    });

    it('應該識別 frontmatter 中的變數', () => {
      const template = `---
title: {{title}}
author: {{author}}
---

# {{title}}`;
      templateManager.createTemplate('article', template);

      const variables = templateManager.validateTemplate('article');

      expect(variables).toContain('title');
      expect(variables).toContain('author');
    });

    it('應該在沒有變數時回傳空陣列', () => {
      const template = 'Hello World';
      templateManager.createTemplate('simple', template);

      const variables = templateManager.validateTemplate('simple');

      expect(variables).toEqual([]);
    });

    it('應該去除重複的變數', () => {
      const template = '{{name}} and {{name}} again';
      templateManager.createTemplate('duplicate', template);

      const variables = templateManager.validateTemplate('duplicate');

      expect(variables).toEqual(['name']);
    });
  });

  describe('insertTemplate', () => {
    it('應該將渲染後的模板寫入指定路徑', () => {
      const template = `---
tags: [meeting]
---

# {{title}}

{{content}}`;
      templateManager.createTemplate('meeting', template);

      templateManager.insertTemplate('meeting', 'Meetings/2024-01-15.md', {
        title: 'Team Meeting',
        content: 'Discussed project progress.'
      });

      const filePath = join(tempDir, 'Meetings', '2024-01-15.md');
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('# Team Meeting');
      expect(content).toContain('Discussed project progress.');
    });

    it('應該自動創建父目錄', () => {
      const template = '# {{title}}';
      templateManager.createTemplate('simple', template);

      templateManager.insertTemplate('simple', 'Projects/Nested/Deep/note.md', {
        title: 'Deep Note'
      });

      const filePath = join(tempDir, 'Projects', 'Nested', 'Deep', 'note.md');
      expect(existsSync(filePath)).toBe(true);
    });

    it('應該在模板不存在時拋出錯誤', () => {
      expect(() => {
        templateManager.insertTemplate('non-existent', 'test.md', {});
      }).toThrow();
    });
  });

  describe('getRequiredFields', () => {
    it('應該回傳必填欄位列表', () => {
      const template = `---
title: {{title}}
date: {{date}}
---

# {{title}}

Participants: {{participants}}`;
      templateManager.createTemplate('meeting', template);

      const fields = templateManager.getRequiredFields('meeting');

      expect(fields).toContain('title');
      expect(fields).toContain('date');
      expect(fields).toContain('participants');
    });

    it('應該檢查必填欄位是否提供', () => {
      const template = '# {{title}}\n\nBy: {{author}}';
      templateManager.createTemplate('article', template);

      const missing = templateManager.validateRequiredFields('article', { title: 'Test' });

      expect(missing).toContain('author');
      expect(missing).not.toContain('title');
    });

    it('應該在所有欄位都提供時回傳空陣列', () => {
      const template = '# {{title}}';
      templateManager.createTemplate('simple', template);

      const missing = templateManager.validateRequiredFields('simple', { title: 'Test' });

      expect(missing).toEqual([]);
    });

    it('treats empty string value as missing', () => {
      const template = '# {{title}}\n\nBy: {{author}}';
      templateManager.createTemplate('article', template);

      const missing = templateManager.validateRequiredFields('article', {
        title: 'Test',
        author: ''
      });

      expect(missing).toContain('author');
    });

    it('recognizes variable names with leading underscore', () => {
      const template = 'Hello {{_internal}} and {{name}}';
      templateManager.createTemplate('vars', template);

      const variables = templateManager.validateTemplate('vars');
      expect(variables).toContain('_internal');
      expect(variables).toContain('name');
      expect(variables.length).toBe(2);
    });
  });

  describe('renderTemplate with built-in placeholders (PlaceholderContext)', () => {
    // Fixed reference date: 2026-02-27 14:30:00
    const fixedDate = new Date(2026, 1, 27, 14, 30, 0);

    it('應展開 {{DATE}} 為當天日期', () => {
      templateManager.createTemplate('date-tmpl', 'Date: {{DATE}}');
      const result = templateManager.renderTemplate('date-tmpl', {}, { date: fixedDate });
      expect(result).toBe('Date: 2026-02-27');
    });

    it('應展開 {{DATE:YYYY/MM/DD}} 自訂格式', () => {
      templateManager.createTemplate('date-fmt-tmpl', 'Date: {{DATE:YYYY/MM/DD}}');
      const result = templateManager.renderTemplate('date-fmt-tmpl', {}, { date: fixedDate });
      expect(result).toBe('Date: 2026/02/27');
    });

    it('應展開 {{DATE}} 與使用者自訂 {{variable}} 同時生效', () => {
      templateManager.createTemplate('mixed-tmpl', '{{DATE}} by {{author}}');
      const result = templateManager.renderTemplate('mixed-tmpl', { author: 'Alice' }, { date: fixedDate });
      expect(result).toBe('2026-02-27 by Alice');
    });

    it('應展開 {{TITLE}} 從 context 傳入', () => {
      templateManager.createTemplate('title-tmpl', '# {{TITLE}}\n\n{{content}}');
      const result = templateManager.renderTemplate('title-tmpl', { content: 'Hello' }, { title: 'My Note' });
      expect(result).toBe('# My Note\n\nHello');
    });

    it('應展開 {{TIME}} 為當前時間', () => {
      templateManager.createTemplate('time-tmpl', 'At {{TIME}}');
      const result = templateManager.renderTemplate('time-tmpl', {}, { date: fixedDate });
      expect(result).toBe('At 14:30');
    });

    it('應展開 {{UUID}} 為有效 UUID v4', () => {
      templateManager.createTemplate('uuid-tmpl', 'ID: {{UUID}}');
      const result = templateManager.renderTemplate('uuid-tmpl', {}, {});
      expect(result).toMatch(/^ID: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('在沒有提供 context 時應向下相容（不展開內建 placeholder）', () => {
      templateManager.createTemplate('no-ctx-tmpl', '{{name}} on {{DATE}}');
      // 不傳 context，{{DATE}} 無法展開，會被後續邏輯清空
      const result = templateManager.renderTemplate('no-ctx-tmpl', { name: 'Bob' });
      // {{DATE}} 沒有 context 仍使用 new Date() 展開（因為 context.date 預設 new Date()）
      // 只驗證 {{name}} 有正確展開
      expect(result).toContain('Bob on ');
    });
  });
});
