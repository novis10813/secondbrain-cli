import type { Loc, Pos } from '../types';

/**
 * Convert a character offset in content to Obsidian-aligned Loc (0-based line/col).
 */
export function indexToLoc(content: string, index: number): Loc {
	const before = content.slice(0, index);
	const lastNewline = before.lastIndexOf('\n');
	const line = (before.match(/\n/g)?.length ?? 0);
	const col = lastNewline === -1 ? index : index - lastNewline - 1;
	return { line, col, offset: index };
}

/**
 * Convert a start/end character range to Obsidian-aligned Pos (start and end Loc).
 */
export function rangeToPos(content: string, startIndex: number, endIndex: number): Pos {
	return {
		start: indexToLoc(content, startIndex),
		end: indexToLoc(content, endIndex)
	};
}
