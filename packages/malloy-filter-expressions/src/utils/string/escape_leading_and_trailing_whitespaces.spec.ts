/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {escapeLeadingAndTrailingWhitespaces} from './escape_leading_and_trailing_whitespaces';

describe('Escape Leading and Trailing Whitespaces', () => {
  it('should return the same string if no trailing/leading spaces', () => {
    expect(escapeLeadingAndTrailingWhitespaces('something')).toBe('something');
    expect(
      escapeLeadingAndTrailingWhitespaces('something with a     space')
    ).toBe('something with a     space');
  });
  it('should escape leading spaces', () => {
    expect(escapeLeadingAndTrailingWhitespaces(' leading space here')).toBe(
      '^ leading space here'
    );
    expect(
      escapeLeadingAndTrailingWhitespaces('  double leading space here')
    ).toBe('^ ^ double leading space here');
  });
  it('should escape trailing spaces', () => {
    expect(escapeLeadingAndTrailingWhitespaces('trailing space here ')).toBe(
      'trailing space here^ ^ '
    );
    expect(
      escapeLeadingAndTrailingWhitespaces('2 trailing spaces here  ')
    ).toBe('2 trailing spaces here^ ^ ^ ');
  });
  it('should escape a leading and trailing space', () => {
    expect(escapeLeadingAndTrailingWhitespaces(' leading and trailing ')).toBe(
      '^ leading and trailing^ ^ '
    );
    expect(
      escapeLeadingAndTrailingWhitespaces('  leading and trailing  ')
    ).toBe('^ ^ leading and trailing^ ^ ^ ');
  });

  it('should not do a double escape at the end', () => {
    expect(escapeLeadingAndTrailingWhitespaces('hello there ', false)).toBe(
      'hello there^ '
    );
  });
});
