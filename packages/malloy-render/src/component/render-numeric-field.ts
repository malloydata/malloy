/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  columnCellFormat,
  formatDateTime,
  formatNumber,
  type CellFormatConfig,
} from '../format/cell-format';
import type {RenderTimeStringOptions} from '../format/time-format';
import type {Field, NumberCell} from '../data_tree';

// The formatting itself lives in ../format (the headless
// `@malloydata/render/format` entry). These wrappers add only what needs a
// Field: its resolved config and its query's timezone.

/**
 * Get the CellFormatConfig for a field, with optional override.
 * The override is used for array elements, where the array field's
 * config should be used instead of the element field's config.
 */
function getConfig(
  f: Field,
  configOverride?: CellFormatConfig
): CellFormatConfig {
  // The field's min/max are the range of its whole column: every row, and
  // every nested row, of this field.
  return columnCellFormat(
    configOverride ?? f.getTagConfig<CellFormatConfig>() ?? {mode: 'default'},
    {min: f.minNumber, max: f.maxNumber}
  );
}

/**
 * Renders a numeric field with formatting based on pre-resolved tag config.
 *
 * Supports:
 * - Currency shorthand: # currency=usd2m, # currency=eur0k
 * - Currency verbose: # currency { scale=m decimals=2 suffix=finance }
 * - Number shorthand: # number=1k, # number=0m, # number=auto
 * - Number verbose: # number { scale=m decimals=2 suffix=word }
 * - Legacy: # number=big, # currency=euro
 */
export function renderNumericField(
  f: Field,
  value: number | null | undefined,
  configOverride?: CellFormatConfig
): string {
  return formatNumber(value, getConfig(f, configOverride));
}

/**
 * Render a big number value (stored as string for precision).
 * Used when NumberCell.stringValue is defined (bigint/bigdecimal subtypes).
 */
export function renderBigNumberField(
  f: Field,
  value: string | null | undefined,
  configOverride?: CellFormatConfig
): string {
  return formatNumber(value, getConfig(f, configOverride));
}

/**
 * Render a NumberCell for display, automatically handling bigint precision.
 *
 * USE THIS FUNCTION when rendering numeric values from cells in plugins/components.
 *
 * @param cell - A NumberCell from the data tree
 * @param configOverride - Optional config override (e.g., for array elements, use the array field's config)
 */
export function renderNumberCell(
  cell: NumberCell,
  configOverride?: CellFormatConfig
): string {
  if (cell.stringValue !== undefined) {
    return renderBigNumberField(cell.field, cell.stringValue, configOverride);
  }
  return renderNumericField(cell.field, cell.value, configOverride);
}

export function renderDateTimeField(
  f: Field,
  value: Date | null | undefined,
  options: RenderTimeStringOptions = {},
  configOverride?: CellFormatConfig
): string {
  // Get the effective query timezone for timestamp fields (not date fields)
  const effectiveTimezone = !options.isDate
    ? (options.timezone ?? f.getEffectiveQueryTimezone())
    : undefined;

  return formatDateTime(value, getConfig(f, configOverride), {
    ...options,
    timezone: effectiveTimezone,
    fieldName: f.name,
  });
}
