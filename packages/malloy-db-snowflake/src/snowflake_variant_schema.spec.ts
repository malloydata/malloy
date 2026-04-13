/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom they are furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY
 * AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
 * THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {SnowflakeDialect} from '@malloydata/malloy';
import {
  accumulateVariantPath,
  buildTopLevelField,
  createVariantSchemaState,
  mergeShape,
  PathParser,
  seedTopLevelShape,
  type NestedColumn,
  type Shape,
} from './snowflake_variant_schema';

describe('snowflake variant schema helper', () => {
  const dialect = new SnowflakeDialect();

  function inferField(
    nestedColumn: NestedColumn,
    rows: Array<{path: string; type: string}>
  ) {
    const state = createVariantSchemaState();
    seedTopLevelShape(state, nestedColumn);
    for (const row of rows) {
      accumulateVariantPath(state, new PathParser(row.path).segments(), row.type);
    }
    return buildTopLevelField(nestedColumn, state, dialect);
  }

  test('reconstructs object shape from descendant-only evidence', () => {
    expect(
      inferField(
        {kind: 'variant', name: 'BASE_TOUCHPOINT'},
        [
          {path: 'BASE_TOUCHPOINT.NETWORK', type: 'varchar'},
          {path: 'BASE_TOUCHPOINT.PLATFORM', type: 'varchar'},
        ]
      )
    ).toEqual({
      type: 'record',
      name: 'BASE_TOUCHPOINT',
      join: 'one',
      fields: [
        {name: 'NETWORK', type: 'string'},
        {name: 'PLATFORM', type: 'string'},
      ],
    });
  });

  test('degrades object-array conflict at a shared prefix', () => {
    expect(
      inferField(
        {kind: 'variant', name: 'X'},
        [
          {path: 'X.Y', type: 'varchar'},
          {path: 'X[*].Z', type: 'decimal'},
        ]
      )
    ).toEqual({
      type: 'sql native',
      rawType: 'variant',
      name: 'X',
    });
  });

  test('builds array of records from stable descendants', () => {
    expect(
      inferField(
        {kind: 'variant', name: 'ITEMS'},
        [
          {path: 'ITEMS[*].FOO', type: 'varchar'},
          {path: 'ITEMS[*].BAR', type: 'boolean'},
        ]
      )
    ).toEqual({
      type: 'array',
      name: 'ITEMS',
      join: 'many',
      elementTypeDef: {type: 'record_element'},
      fields: [
        {name: 'FOO', type: 'string'},
        {name: 'BAR', type: 'boolean'},
      ],
    });
  });

  test('top-level array with no descendants becomes array of variant', () => {
    expect(inferField({kind: 'array', name: 'DIMENSION_SET_IDS'}, [])).toEqual({
      type: 'array',
      name: 'DIMENSION_SET_IDS',
      join: 'many',
      elementTypeDef: {type: 'sql native', rawType: 'variant'},
      fields: [
        {name: 'value', type: 'sql native', rawType: 'variant'},
        {
          name: 'each',
          type: 'sql native',
          rawType: 'variant',
          e: {node: 'field', path: ['value']},
        },
      ],
    });
  });

  test('top-level DESCRIBE seed stays authoritative over conflicting sample', () => {
    expect(
      inferField(
        {kind: 'array', name: 'DIMENSION_SET_IDS'},
        [{path: 'DIMENSION_SET_IDS.foo', type: 'varchar'}]
      )
    ).toEqual({
      type: 'array',
      name: 'DIMENSION_SET_IDS',
      join: 'many',
      elementTypeDef: {type: 'sql native', rawType: 'variant'},
      fields: [
        {name: 'value', type: 'sql native', rawType: 'variant'},
        {
          name: 'each',
          type: 'sql native',
          rawType: 'variant',
          e: {node: 'field', path: ['value']},
        },
      ],
    });
  });

  test('top-level object with no descendants becomes opaque variant', () => {
    expect(inferField({kind: 'object', name: 'PAYLOAD'}, [])).toEqual({
      type: 'sql native',
      rawType: 'variant',
      name: 'PAYLOAD',
    });
  });

  test('quoted path names with punctuation are preserved', () => {
    expect(
      inferField(
        {kind: 'variant', name: 'DATA'},
        [{path: "DATA['a.b'][*]['c[d]']", type: 'varchar'}]
      )
    ).toEqual({
      type: 'record',
      name: 'DATA',
      join: 'one',
      fields: [
        {
          type: 'array',
          name: 'a.b',
          join: 'many',
          elementTypeDef: {type: 'record_element'},
          fields: [{name: 'c[d]', type: 'string'}],
        },
      ],
    });
  });

  test('leaf-type conflicts degrade to variant', () => {
    const first: Shape = {kind: 'leaf', type: 'varchar'};
    const second: Shape = {kind: 'leaf', type: 'decimal'};
    expect(mergeShape(first, second)).toEqual({kind: 'variant'});
  });

  test('variant shape is monotonic', () => {
    expect(mergeShape({kind: 'variant'}, {kind: 'object'})).toEqual({
      kind: 'variant',
    });
  });
});
