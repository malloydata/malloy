/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {escapeWithCaret} from './escape_with_caret';

describe('Escape With Caret', () => {
  describe('when the string contains any special characters', () => {
    it('returns the same string with special characters escaped with a caret', () => {
      expect(escapeWithCaret('something^')).toBe('something^^');
      expect(escapeWithCaret('something_')).toBe('something^_');
      expect(escapeWithCaret('something%')).toBe('something^%');
      expect(escapeWithCaret('something,')).toBe('something^,');
    });
  });

  describe('when the string does not contain any special characters', () => {
    it('returns the same string', () => {
      expect(escapeWithCaret('some-thing;.')).toBe('some-thing;.');
    });
  });
});
