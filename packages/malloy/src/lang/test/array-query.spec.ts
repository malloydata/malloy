/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {errorMessage, model} from './test-translator';
import './parse-expects';
import {isQuerySegment} from '../../model';

/*
 * `array -> { aggregate: ... }`: a query on the elements of an array of the
 * current row, whose value is a value of that row. Experimental.
 */
describe('array queries', () => {
  test('a record array, aggregated per row', () => {
    const m = model`
      ##! experimental.array_queries
      run: a -> {
        group_by: total is astruct -> { aggregate: n is column.sum() }
      }
    `;
    expect(m).toTranslate();
    const segment = m.translator.getQuery(0)?.pipeline[0];
    if (segment === undefined || !isQuerySegment(segment)) {
      throw new Error('expected a query segment');
    }
    const [total] = segment.queryFields;
    expect(total).toMatchObject({
      name: 'total',
      type: 'number',
      e: {
        node: 'arrayQuery',
        kids: {array: {node: 'field', path: ['astruct']}},
      },
    });
    // The array is read as a column of the row, not unnested.
    expect(segment.activeJoins).toEqual([]);
  });

  test('what the query reads is a weak reference through the array', () => {
    const m = model`
      ##! experimental.array_queries
      run: a -> {
        group_by: total is astruct -> {
          aggregate: n is column.sum() { where: column > 1 }
        }
      }
    `;
    expect(m).toTranslate();
    const segment = m.translator.getQuery(0)?.pipeline[0];
    if (segment === undefined || !isQuerySegment(segment)) {
      throw new Error('expected a query segment');
    }
    // The array itself, and its elements' field, read in place: no join is
    // activated, and the aggregate over the elements asks for no distinct
    // key of the row's query.
    expect(segment.expandedFieldUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({path: ['astruct']}),
        expect.objectContaining({
          path: ['astruct', 'column'],
          inPlaceDepth: 2,
        }),
      ])
    );
    for (const usage of segment.expandedFieldUsage ?? []) {
      expect(usage.uniqueKeyRequirement).toBeUndefined();
    }
    expect(segment.activeJoins).toEqual([]);
  });

  test('an array an array query made is joined without the array it read', () => {
    const m = model`
      ##! experimental.array_queries
      source: s is a extend {
        dimension: doubled is astruct -> { select: d is column * 2 }
      }
      run: s -> { aggregate: t is doubled.d.sum() }
    `;
    expect(m).toTranslate();
    const segment = m.translator.getQuery(0)?.pipeline[0];
    if (segment === undefined || !isQuerySegment(segment)) {
      throw new Error('expected a query segment');
    }
    // `doubled` is unnested, to sum its elements; `astruct`, which it was
    // made from in place, is not.
    expect(segment.activeJoins).toEqual([{path: ['doubled']}]);
  });

  test('a path read both in place and through a join is a join', () => {
    const m = model`
      ##! experimental.array_queries
      run: a -> {
        group_by:
          total is astruct -> { aggregate: n is column.sum() }
          astruct.column
      }
    `;
    expect(m).toTranslate();
    const segment = m.translator.getQuery(0)?.pipeline[0];
    if (segment === undefined || !isQuerySegment(segment)) {
      throw new Error('expected a query segment');
    }
    const column = segment.expandedFieldUsage?.find(
      u => u.path.join('.') === 'astruct.column'
    );
    expect(column?.inPlaceDepth).toBeUndefined();
    expect(segment.activeJoins).toEqual([{path: ['astruct']}]);
  });

  test('where the dialect returns no arrays, only one value', () => {
    const onPresto = (arrow: string) => model`
      ##! experimental.array_queries
      source: p is _presto_.table('aTable')
      run: p -> { group_by: t is ${arrow} }
    `;
    expect(
      onPresto('astruct -> { aggregate: n is column.sum() }')
    ).toTranslate();
    for (const arrow of [
      'astruct -> { select: column; where: column > 1 }',
      'astruct -> { group_by: column }',
      'astruct -> { aggregate: n is count() } -> { select: n }',
    ]) {
      expect(onPresto(arrow)).toLog(
        errorMessage(/can only query an array for one value/)
      );
    }
  });

  test('array functions compute one aggregate, and no having:', () => {
    const onPresto = (arrow: string) => model`
      ##! experimental.array_queries
      source: p is _presto_.table('aTable')
      run: p -> { group_by: t is ${arrow} }
    `;
    const onPostgres = (arrow: string) => model`
      ##! experimental.array_queries
      source: p is _pg_.table('aTable')
      run: p -> { group_by: t is ${arrow} }
    `;
    const onDuckDB = (arrow: string) => model`
      ##! experimental.array_queries
      run: a -> { group_by: t is ${arrow} }
    `;
    const having = 'astruct -> { aggregate: n is count(); having: n > 1 }';
    const notOne = 'astruct -> { aggregate: n is column.sum() / count() }';
    // Presto has only its array functions
    expect(onPresto(having)).toLog(
      errorMessage(/cannot query this array: it has a `having:`/)
    );
    expect(onPresto(notOne)).toLog(
      errorMessage(/cannot query this array: `n` is not one aggregate/)
    );
    // Postgres computes one value as a correlated subquery, and DuckDB
    // falls back on one, so neither is limited to one aggregate
    for (const on of [onPostgres, onDuckDB]) {
      expect(on(having)).toTranslate();
      expect(on(notOne)).toTranslate();
    }
    expect(onPostgres('astruct -> { select: column }')).toLog(
      errorMessage(/can only query an array for one value/)
    );
  });

  test('an array of scalars, through each', () => {
    expect(model`
      ##! experimental.array_queries
      run: a -> {
        group_by: big is ais -> { aggregate: n is count() { where: each > 1 } }
      }
    `).toTranslate();
  });

  test('after the arrow, an operator and a field name are an expression', () => {
    const sum = 'astruct -> { aggregate: n is column.sum() }';
    for (const e of [
      `${sum} + 7`,
      `${sum} > 1000`,
      `ai + ${sum}`,
      `(${sum}) + ai`,
      `${sum} + ai`,
      `${sum} + ai * 2`,
    ]) {
      expect(model`
        ##! experimental.array_queries
        run: a -> { group_by: t is ${e} }
      `).toTranslate();
    }
    const m = model`
      ##! experimental.array_queries
      run: a -> { group_by: t is ${sum} + ai }
    `;
    expect(m).toTranslate();
    const segment = m.translator.getQuery(0)?.pipeline[0];
    if (segment === undefined || !isQuerySegment(segment)) {
      throw new Error('expected a query segment');
    }
    expect(segment.queryFields[0]).toMatchObject({
      e: {node: '+', kids: {left: {node: 'arrayQuery'}, right: {path: ['ai']}}},
    });
  });

  test('stages are chained `{ ... }` blocks, and nothing else', () => {
    expect(model`
      ##! experimental.array_queries
      run: a -> {
        group_by: t is astruct -> { group_by: column } -> { aggregate: n is count() }
      }
    `).toTranslate();
    // An element has no views, so the arrow's right side never names one.
    expect(model`
      ##! experimental.array_queries
      run: a -> { group_by: t is astruct -> column }
    `).not.toTranslate();
  });

  test('needs the experiment', () => {
    expect(
      model`run: a -> { group_by: t is astruct -> { aggregate: n is column.sum() } }`
    ).toLog(errorMessage(/array_queries/));
  });

  test('only an array can be queried', () => {
    expect(model`
      ##! experimental.array_queries
      run: a -> { group_by: t is ai -> { aggregate: n is count() } }
    `).not.toTranslate();
  });

  test('a query with rows returns an array of records', () => {
    const m = model`
      ##! experimental.array_queries
      source: s is a extend {
        dimension:
          picked is astruct -> { select: *; where: column > 1 }
          grouped is astruct -> {
            group_by: column
            aggregate: n is count()
          }
      }
      run: s -> { select: picked, grouped }
    `;
    expect(m).toTranslate();
    const segment = m.translator.getQuery(0)?.pipeline[0];
    if (segment === undefined || !isQuerySegment(segment)) {
      throw new Error('expected a query segment');
    }
    const [picked, grouped] = segment.outputStruct.fields;
    expect(picked).toMatchObject({
      type: 'array',
      elementTypeDef: {type: 'record_element'},
      fields: [{name: 'column'}],
    });
    expect(grouped).toMatchObject({
      type: 'array',
      fields: [{name: 'column'}, {name: 'n'}],
    });
  });

  test('several aggregates are refused', () => {
    expect(model`
      ##! experimental.array_queries
      run: a -> {
        group_by: t is astruct -> { aggregate: n is count(), m is column.sum() }
      }
    `).not.toTranslate();
  });
});
