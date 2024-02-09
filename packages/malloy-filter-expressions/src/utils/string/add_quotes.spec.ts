/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {addQuotes} from './add_quotes';

describe('Add quotes', () => {
  describe('when the string contains any special characters', () => {
    it('returns the same string enclosed in quotation marks', () => {
      expect(addQuotes('something,')).toBe('"something,"');
      expect(addQuotes("something'")).toBe('"something\'"');
      expect(addQuotes('something"')).toBe('"something""');
    });
  });

  describe('when the string starts with a `-`', () => {
    it('returns the same string enclosed in quotation marks', () => {
      expect(addQuotes('-something')).toBe('"-something"');
    });
  });

  describe('when the string contains a `-`, but not at the start', () => {
    it('returns the same string not enclosed in quotation marks', () => {
      expect(addQuotes('some-thing')).toBe('some-thing');
    });
  });
});
