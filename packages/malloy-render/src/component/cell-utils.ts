/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Cell} from '../data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import {NULL_SYMBOL} from '../util';
import {renderNumberCell, renderDateTimeField} from './render-numeric-field';

export interface RenderCellValueOptions {
  /**
   * Value to return for null cells.
   * Defaults to NULL_SYMBOL ('∅').
   */
  nullValue?: string;
  /**
   * Override tag for formatting.
   * Use this when rendering array elements - pass the array field's tag
   * so formatting (currency, percent, etc.) is applied from the array definition.
   * If not provided, uses the cell's own field tag.
   */
  tag?: Tag;
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
 * // Array elements - use array field's tag for formatting
 * renderCellValue(elementCell, { tag: arrayField.tag })
 *
 * @example
 * // Custom null display
 * renderCellValue(cell, { nullValue: '' })
 */
export function renderCellValue(
  cell: Cell,
  options: RenderCellValueOptions = {}
): string {
  const {nullValue = NULL_SYMBOL, tag} = options;

  if (cell.isNull()) {
    return nullValue;
  }

  if (cell.isNumber()) {
    return renderNumberCell(cell, tag);
  }

  if (cell.isDate()) {
    return renderDateTimeField(
      cell.field,
      cell.value,
      {
        isDate: true,
        timeframe: cell.timeframe,
      },
      tag
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
      tag
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
