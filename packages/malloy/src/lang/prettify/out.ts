/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {INDENT_STR} from './tokens';

// Append-only buffer with helpers for indentation, single-space coalescing,
// and newlines. Knows nothing about Malloy; the formatting rules call into it.
export class Out {
  buf = '';
  indent = 0;

  // Append text. If the buffer ended with a newline, prepend the current
  // indent first so the new text starts at the right column.
  text(s: string): void {
    if (this.buf.endsWith('\n')) this.buf += INDENT_STR.repeat(this.indent);
    this.buf += s;
  }

  // Append at most one space. No-op at start of buffer, after newline, or
  // after `(`, `[`, `.` (so `f(x` stays glued).
  space(): void {
    if (this.buf.length === 0) return;
    const last = this.buf[this.buf.length - 1];
    if (
      last === ' ' ||
      last === '\n' ||
      last === '(' ||
      last === '[' ||
      last === '.'
    )
      return;
    this.buf += ' ';
  }

  // Force the next emit onto a new line. Trailing spaces are stripped.
  nl(): void {
    if (this.buf.length === 0) return;
    this.buf = this.buf.replace(/ +$/, '');
    if (!this.buf.endsWith('\n')) this.buf += '\n';
  }

  // Force a blank line before the next emit. No-op at start of buffer.
  blank(): void {
    if (this.buf.length === 0) return;
    this.nl();
    if (!this.buf.endsWith('\n\n')) this.buf += '\n';
  }

  trimTrailingSpace(): void {
    this.buf = this.buf.replace(/ +$/, '');
  }

  lastChar(): string | null {
    return this.buf.length === 0 ? null : this.buf[this.buf.length - 1];
  }

  // The column the next emit will land at. When the buffer ends with a
  // newline the indent isn't yet in `buf`, so we have to add the pending
  // indent width to predict where the next text will appear.
  lineLengthSoFar(): number {
    if (this.buf.length === 0 || this.buf.endsWith('\n')) {
      return this.indent * INDENT_STR.length;
    }
    const lastNl = this.buf.lastIndexOf('\n');
    return this.buf.length - (lastNl + 1);
  }

  toString(): string {
    return this.buf.replace(/\n*$/, '\n');
  }
}
