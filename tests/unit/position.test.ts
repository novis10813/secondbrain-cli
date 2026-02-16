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
	});
});
