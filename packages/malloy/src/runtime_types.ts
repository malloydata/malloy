/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * The contents of a Malloy query document.
 */
export type QueryString = string;

/**
 * The contents of a Malloy model document.
 */
export type ModelString = string;

/**
 * A URL whose contents is a Malloy model.
 */
export type ModelURL = URL;

/**
 * A URL whose contents is a Malloy query.
 */
export type QueryURL = URL;

/**
 * An object capable of reading the contents of a URL in some context.
 */
export interface URLReader {
  /**
   * Read the contents of the given URL.
   *
   * @param url The URL to read.
   * @return A promise to the contents of the URL.
   */
  readURL: (url: URL) => Promise<string>;
}
