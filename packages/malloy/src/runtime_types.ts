/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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

// An null InvalidationKey indicates to not cache...
export type InvalidationKey = string | number | Date | null;

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
  readURL: (
    url: URL
  ) => Promise<string | {contents: string; invalidationKey?: InvalidationKey}>;
  getInvalidationKey?: (url: URL) => Promise<InvalidationKey>;
}

export interface EventStream {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(id: string, data: any): void;
}
