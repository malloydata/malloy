/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Currency cells take their default decimals from their whole column: the
// field's min/max over every row, including every nested row.

import {API} from '@malloydata/malloy';
import {runtimeFor} from '../../../../test/src/runtimes';
import {RenderFieldMetadata} from '@/render-field-metadata';
import {getDataTree} from '@/data_tree';
import type {RecordCell} from '@/data_tree';
import {renderNumberCell} from './render-numeric-field';

const duckdb = runtimeFor('duckdb');

afterAll(async () => {
  await duckdb.connection.close();
});

async function cellsOf(query: string, column: string, nest?: string) {
  const result = await duckdb.loadQuery(query).run();
  const malloyResult = API.util.wrapResult(result);
  const rootCell = getDataTree(
    malloyResult,
    new RenderFieldMetadata(malloyResult)
  );
  const rows: RecordCell[] = nest
    ? rootCell.rows.flatMap(r => {
        const n = r.column(nest);
        if (n.isRepeatedRecord()) return n.rows;
        return n.isRecord() ? [n] : [];
      })
    : rootCell.rows;
  return rows.map(r => {
    const cell = r.column(column);
    return cell.isNumber() ? renderNumberCell(cell) : String(cell.value);
  });
}

const PRICES =
  "duckdb.sql(\"SELECT * FROM (VALUES ('a', 9.99), ('b', 42.5), ('c', 0.35)) t(k, v)\")";
const REVENUE =
  "duckdb.sql(\"SELECT * FROM (VALUES ('a', 1250000.0), ('b', 148.0), ('c', 3.25)) t(k, v)\")";

describe('currency cells: cents by column', () => {
  test('a column of values under 100 keeps cents', async () => {
    expect(
      await cellsOf(
        `run: ${PRICES} -> { group_by: k; aggregate: # currency
           p is sum(v); order_by: k }`,
        'p'
      )
    ).toEqual(['$9.99', '$42.50', '$0.35']);
  });

  test('a column with a value of 100 or more drops cents', async () => {
    expect(
      await cellsOf(
        `run: ${REVENUE} -> { group_by: k; aggregate: # currency
           r is sum(v); order_by: k }`,
        'r'
      )
    ).toEqual(['$1,250,000', '$148', '$3']);
  });

  test('a nested column is judged across all of its rows', async () => {
    expect(
      await cellsOf(
        `run: ${REVENUE} -> {
           group_by: k
           nest: n is { aggregate: # currency
             r is sum(v) }
           order_by: k
         }`,
        'r',
        'n'
      )
    ).toEqual(['$1,250,000', '$148', '$3']);
  });

  test('currency=usd2 keeps cents', async () => {
    expect(
      await cellsOf(
        `run: ${REVENUE} -> { group_by: k; aggregate: # currency=usd2
           r is sum(v); order_by: k }`,
        'r'
      )
    ).toEqual(['$1,250,000.00', '$148.00', '$3.25']);
  });
});
