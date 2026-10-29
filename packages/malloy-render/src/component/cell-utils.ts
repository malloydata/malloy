/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Cell} from '../data_tree';
import {NULL_SYMBOL} from '../util';
import {renderNumberCell, renderDateTimeField} from './render-numeric-field';
import type {CellFormatConfig} from './tag-configs';

export interface RenderCellValueOptions {
  /**
   * Value to return for null cells.
   * Defaults to NULL_SYMBOL ('∅').
   */
  nullValue?: string;
  /**
   * Override format config.
   * Use this when rendering array elements - pass the array field's
   * pre-resolved config so formatting (currency, percent, etc.) is
   * applied from the array definition.
   * If not provided, uses the cell's own field's tag config.
   */
  config?: CellFormatConfig;
}

/**
 * Render a Cell value to a formatted display string.
 *
 * Handles all cell types with appropriate formatting:
 * - Numbers: uses renderNumberCell (handles bigint precision + formatting tags)
 * - Dates: uses renderDateTimeField with isDate: true
 * - Timestamps: uses renderDateTimeField with isDate: false
 * - Strings: returns value directly
 * - Booleans: returns 'true' or 'false'
 * - Null: returns nullValue option (defaults to NULL_SYMBOL)
 *
 * @example
 * // Basic usage (pivot headers, etc.)
 * renderCellValue(cell)
 *
 * @example
 * // Array elements - use array field's config for formatting
 * renderCellValue(elementCell, { config: arrayField.getTagConfig() })
 *
 * @example
 * // Custom null display
 * renderCellValue(cell, { nullValue: '' })
 */
export function renderCellValue(
  cell: Cell,
  options: RenderCellValueOptions = {}
): string {
  const {nullValue = NULL_SYMBOL, config} = options;

  if (cell.isNull()) {
    return nullValue;
  }

  if (cell.isNumber()) {
    return renderNumberCell(cell, config);
  }

  if (cell.isDate()) {
    return renderDateTimeField(
      cell.field,
      cell.value,
      {
        isDate: true,
        timeframe: cell.timeframe,
      },
      config
    );
  }

  if (cell.isTimestamp()) {
    return renderDateTimeField(
      cell.field,
      cell.value,
      {
        isDate: false,
        timeframe: cell.timeframe,
      },
      config
    );
  }

  if (cell.isBoolean()) {
    return String(cell.value);
  }

  if (cell.isString()) {
    return cell.value;
  }

  // Fallback for any other types
  return String(cell.value);
}
