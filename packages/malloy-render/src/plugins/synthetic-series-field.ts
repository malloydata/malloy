/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * The slice of `Field` the chart spec generators read off a series field,
 * so the bar and line plugins' synthetic series fields stay honestly typed.
 */
export interface SyntheticSeriesField {
  name: string;
  getLabel: () => string;
  valueSet: ReadonlySet<string | number | boolean>;
  referenceId: string;
  // Never set by synthetics; the bar generator's legend-sizing read needs it.
  maxString?: string;
}
