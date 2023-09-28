import { ParserRuleContext } from "antlr4";
import {DocumentRange} from '../../model/malloy_types';

export function rangeOf(ctx: ParserRuleContext): DocumentRange {
  const stopToken = ctx.stop || ctx.start;
  return {
    start: {
      line: ctx.start.line - 1,
      character: ctx.start.column,
    },
    end: {
      line: stopToken.line - 1,
      character:
        stopToken.stop -
        (stopToken.start - stopToken.column) +
        1,
    },
  };
}

export function inRange(position: {line: number, character: number}, range: DocumentRange): boolean {
  return (
    range.start.line <= position.line &&
    range.end.line >= position.line &&
    (position.line !== range.start.line ||
      position.character >= range.start.character) &&
    (position.line !== range.end.line ||
      position.character <= range.end.character)
  );
}