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

  test('an array of scalars, through each', () => {
    expect(model`
      ##! experimental.array_queries
      run: a -> {
        group_by: big is ais -> { aggregate: n is count() { where: each > 1 } }
      }
    `).toTranslate();
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

  test('for now, only one aggregate', () => {
    expect(model`
      ##! experimental.array_queries
      run: a -> { group_by: t is astruct -> { group_by: column } }
    `).not.toTranslate();
    expect(model`
      ##! experimental.array_queries
      run: a -> {
        group_by: t is astruct -> { aggregate: n is count(), m is column.sum() }
      }
    `).not.toTranslate();
  });
});
