/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * This function is escapes leading and trailing spaces with a caret for the
 * given string. Trailing spaces are doubly escaped.
 *
 * Double escape param is true when the filter type is matches, but false for "like" filters
 * as they
 */
export const escapeLeadingAndTrailingWhitespaces = (
  value: string,
  doubleEscapeLastEscapedTrailingSpace = true
) => {
  // the following regex escapes leading and trailing spaces only
  // (leaving other spaces, such as between two letters, as they are)
  let str = value.replace(
    /^([ ]*)(.*?)([ ]*)$/g,
    (_: string, g1?: string, g2?: string, g3?: string) => {
      const leading = g1 ? g1.replace(/[ ]/g, '^ ') : '';
      const content = g2 || '';
      const trailing = g3 ? g3.replace(/[ ]/g, '^ ') : '';
      return leading + content + trailing;
    }
  );

  // we add a "^ "" at the end of the string to ensure the right-most escaped space is
  // not trimmed, most notably when the clause is "ends with" or "!ends with".
  // The thing is that the ending "^ " is disregarded by the server because of an "rstrip"
  // don't add the extra space when the given string includes a quote (single or double),
  // the server side rstrip does not apply in that case
  if (
    str.endsWith('^ ') &&
    !str.includes("'") &&
    !str.includes('"') &&
    doubleEscapeLastEscapedTrailingSpace
  ) {
    str += '^ ';
  }
  return str;
};
