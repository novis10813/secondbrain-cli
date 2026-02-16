import { describe, it, expect } from 'bun:test';
import { indexToLoc, rangeToPos } from '../../src/utils/position';

describe('position', () => {
	describe('indexToLoc', () => {
		it('returns line 0, col 0, offset 0 for start of content', () => {
			const loc = indexToLoc('hello', 0);
			expect(loc).toEqual({ line: 0, col: 0, offset: 0 });
		});

		it('returns correct col and offset within first line', () => {
			const loc = indexToLoc('hello', 3);
			expect(loc).toEqual({ line: 0, col: 3, offset: 3 });
		});

		it('uses 0-based line after newline', () => {
			const content = 'line0\nline1';
			expect(indexToLoc(content, 0)).toEqual({ line: 0, col: 0, offset: 0 });
			expect(indexToLoc(content, 5)).toEqual({ line: 0, col: 5, offset: 5 }); // at \n
			expect(indexToLoc(content, 6)).toEqual({ line: 1, col: 0, offset: 6 });
			expect(indexToLoc(content, 11)).toEqual({ line: 1, col: 5, offset: 11 });
		});

		it('handles empty string at index 0', () => {
			const loc = indexToLoc('', 0);
			expect(loc).toEqual({ line: 0, col: 0, offset: 0 });
		});

		it('handles multiple lines', () => {
			const content = 'a\nbb\nccc';
			expect(indexToLoc(content, 2)).toEqual({ line: 1, col: 0, offset: 2 });
			expect(indexToLoc(content, 5)).toEqual({ line: 2, col: 0, offset: 5 });
			expect(indexToLoc(content, 8)).toEqual({ line: 2, col: 3, offset: 8 }); // last char
		});

		it('index at content.length gives position after last character', () => {
			const content = 'hello';
			const loc = indexToLoc(content, 5);
			expect(loc).toEqual({ line: 0, col: 5, offset: 5 });
		});

		it('index at content.length on multi-line gives end of last line', () => {
			const content = 'a\nbb\nccc';
			const loc = indexToLoc(content, 9);
			expect(loc).toEqual({ line: 2, col: 4, offset: 9 });
		});

		it('extracts correct loc for single character line', () => {
			const content = 'x';
			expect(indexToLoc(content, 0)).toEqual({ line: 0, col: 0, offset: 0 });
			expect(indexToLoc(content, 1)).toEqual({ line: 0, col: 1, offset: 1 });
		});
	});

	describe('rangeToPos', () => {
		it('returns Pos with start and end Loc for range', () => {
			const content = '[[link]]';
			const pos = rangeToPos(content, 0, 8);
			expect(pos.start).toEqual({ line: 0, col: 0, offset: 0 });
			expect(pos.end).toEqual({ line: 0, col: 8, offset: 8 });
		});

		it('returns correct Pos for span across lines', () => {
			const content = 'line0\nline1';
			const pos = rangeToPos(content, 2, 8);
			expect(pos.start).toEqual({ line: 0, col: 2, offset: 2 });
			expect(pos.end).toEqual({ line: 1, col: 2, offset: 8 });
		});

		it('returns same start and end for zero-length range', () => {
			const content = 'hello';
			const pos = rangeToPos(content, 2, 2);
			expect(pos.start).toEqual(pos.end);
			expect(pos.start).toEqual({ line: 0, col: 2, offset: 2 });
		});

		it('returns full-content range from 0 to content.length', () => {
			const content = 'line0\nline1';
			const pos = rangeToPos(content, 0, content.length);
			expect(pos.start).toEqual({ line: 0, col: 0, offset: 0 });
			expect(pos.end).toEqual({ line: 1, col: 5, offset: 11 });
		});

		it('returns range at end of content (last char to end)', () => {
			const content = 'abc';
			const pos = rangeToPos(content, 2, 3);
			expect(pos.start).toEqual({ line: 0, col: 2, offset: 2 });
			expect(pos.end).toEqual({ line: 0, col: 3, offset: 3 });
		});

		it('returns correct Pos for range spanning two lines', () => {
			const content = 'aa\nbb\ncc';
			const pos = rangeToPos(content, 4, 6);
			expect(pos.start).toEqual({ line: 1, col: 1, offset: 4 });
			expect(pos.end).toEqual({ line: 2, col: 0, offset: 6 });
		});
	});
});
