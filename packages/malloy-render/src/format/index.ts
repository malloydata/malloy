/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// `@malloydata/render/format` — how one value displays, without the renderer.
//
// The renderer's cell formats (`# currency`, `# percent`, `# duration`,
// `# number`), resolved from a field's tag and applied to a single value. The
// renderer's own cells call these same functions, so a value formatted here
// reads exactly as it does in a rendered table. Headless: no DOM, no Solid, no
// Vega — loadable in Node and in a sandboxed frame.

export {
  NULL_SYMBOL,
  formatDateTime,
  formatNumber,
  resolveCellFormat,
  type CellFormatConfig,
  type CurrencyConfig,
  type DurationConfig,
  type NumberConfig,
} from './cell-format';
export {
  formatScaledNumber,
  type FormatScaledNumberOptions,
  type ScaleKey,
  type SuffixFormatKey,
} from './number-format';
export {
  formatDuration,
  renderTimeString,
  type RenderTimeStringOptions,
} from './time-format';
