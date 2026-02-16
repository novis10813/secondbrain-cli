import { describe, it, expect } from 'bun:test';
import { NoteParser } from '../../src/utils/parser';

const sampleNote = `---
title: Performance Test Note
tags: [perf, test, metadata]
---

# Main Title

Content with #inline-tag and [[linked-note]] and [[other|display]].

## Section One

Paragraph with ^block-ref-1 and ^block-ref-2.

![[image.png]] and ![[doc.pdf|PDF]].

\`\`\`js
// code block with #fake-tag and ^fake-block
\`\`\`

## Section Two

More content with #another-tag.
`;

describe('Parser performance', () => {
  it('parses a note with full metadata extraction within acceptable time', () => {
    const iterations = 200;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      NoteParser.parse(sampleNote);
    }
    const elapsed = performance.now() - start;
    const msPerParse = elapsed / iterations;
    expect(msPerParse).toBeLessThan(2);
  });

  it('parses a larger note within acceptable time', () => {
    const lines: string[] = ['---', 'tags: [a, b]', '---', '', '# Doc', ''];
    for (let i = 0; i < 500; i++) {
      lines.push(`## Section ${i}`);
      lines.push(`Text with #tag-${i} and [[link-${i}]] and ^block-${i}.`);
    }
    const largeNote = lines.join('\n');
    const start = performance.now();
    const parsed = NoteParser.parse(largeNote);
    const elapsed = performance.now() - start;
    expect(parsed.headings).toHaveLength(501); // # Doc + 500 ## Section N
    expect(elapsed).toBeLessThan(150);
  });
});
