/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
      accumulateVariantPath(
        state,
        new PathParser(row.path).segments(),
        row.type
      );
    }
    return buildTopLevelField(nestedColumn, state, dialect);
  }

  test('reconstructs object shape from descendant-only evidence', () => {
    expect(
      inferField({kind: 'variant', name: 'BASE_TOUCHPOINT'}, [
        {path: 'BASE_TOUCHPOINT.NETWORK', type: 'varchar'},
        {path: 'BASE_TOUCHPOINT.PLATFORM', type: 'varchar'},
      ])
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
      inferField({kind: 'variant', name: 'X'}, [
        {path: 'X.Y', type: 'varchar'},
        {path: 'X[*].Z', type: 'decimal'},
      ])
    ).toEqual({
      type: 'sql native',
      rawType: 'variant',
      name: 'X',
    });
  });

  test('builds array of records from stable descendants', () => {
    expect(
      inferField({kind: 'variant', name: 'ITEMS'}, [
        {path: 'ITEMS[*].FOO', type: 'varchar'},
        {path: 'ITEMS[*].BAR', type: 'boolean'},
      ])
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
      inferField({kind: 'array', name: 'DIMENSION_SET_IDS'}, [
        {path: 'DIMENSION_SET_IDS.foo', type: 'varchar'},
      ])
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
      inferField({kind: 'variant', name: 'DATA'}, [
        {path: "DATA['a.b'][*]['c[d]']", type: 'varchar'},
      ])
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

  test('scalar-vs-object at same path degrades that field only', () => {
    // The sample emits both the scalar observation and the object
    // observation (same path, two rows from the distinct (path, type)
    // query). mergeShape collapses DATA.foo to variant; the parent
    // DATA stays a record and siblings keep their types.
    expect(
      inferField({kind: 'variant', name: 'DATA'}, [
        {path: 'DATA.foo', type: 'object'},
        {path: 'DATA.foo', type: 'varchar'},
        {path: 'DATA.foo.bar', type: 'decimal'},
        {path: 'DATA.sib', type: 'varchar'},
      ])
    ).toEqual({
      type: 'record',
      name: 'DATA',
      join: 'one',
      fields: [
        {type: 'sql native', rawType: 'variant', name: 'foo'},
        {type: 'string', name: 'sib'},
      ],
    });
  });

  test('variant shape is monotonic', () => {
    expect(mergeShape({kind: 'variant'}, {kind: 'object'})).toEqual({
      kind: 'variant',
    });
  });
});
