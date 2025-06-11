import type * as Malloy from '@malloydata/malloy-interfaces';
import {RootCell} from './cells';
import type {RenderFieldMetadata} from '../render-field-metadata';

export function getDataTree(
  result: Malloy.Result,
  renderFieldMetadata: RenderFieldMetadata
) {
  // Use the pre-calculated RootField from RenderFieldMetadata
  const rootField = renderFieldMetadata.getRootField();

  const cell: Malloy.DataWithArrayCell =
    result.data!.kind === 'record_cell'
      ? {kind: 'array_cell', array_value: [result.data!]}
      : result.data!;

  const rootCell = new RootCell(cell, rootField);
  return rootCell;
}

// Export everything from the old file, but now from the new modules
export * from './cells/base';
export * from './types';
export * from './plugins';
export * from './fields';
export * from './cells';
export * from './utils';
export * from './drilling';
