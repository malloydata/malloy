/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

declare module 'vega' {
  // vega-typings does not export the typing for locale
  const locale: () => {format: (f: string) => (v: number) => string};
}
