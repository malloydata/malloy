/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {DataRecord, WriteStream} from '@malloydata/malloy';
import {CSVWriter, JSONWriter} from '@malloydata/malloy';
import {RuntimeList} from '../runtimes';
import {describeIfDatabaseAvailable} from '../util';

class StringAccumulator implements WriteStream {
  public accumulatedValue = '';

  write(text: string) {
    this.accumulatedValue += text;
  }

  close() {
    return;
  }
}

const [describe, databases] = describeIfDatabaseAvailable([
  'bigquery',
  'postgres',
  'duckdb',
  'duckdb_wasm',
]);

describe('Streaming tests', () => {
  if (!databases.length) {
    it.skip('skipped', () => {});
  }
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  runtimes.runtimeMap.forEach((runtime, databaseName) => {
    it(`basic stream test  - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: airports is ${databaseName}.table('malloytest.airports')`
        )
        .loadQuery('run: airports -> { select: code; order_by: code }')
        .runStream({rowLimit: 10});
      const rows: DataRecord[] = [];
      for await (const row of stream) {
        rows.push(row);
      }
      expect(rows.length).toBe(10);
      expect(rows[0].cell('code').string.value).toBe('00A');
    });

    it(`stream to JSON - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: airports is ${databaseName}.table('malloytest.airports')`
        )
        .loadQuery('run: airports -> { select: code; order_by: code }')
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const jsonWriter = new JSONWriter(accummulator);
      await jsonWriter.process(stream);
      expect(accummulator.accumulatedValue).toBe(
        `[
  {
    "code": "00A"
  }
]
`
      );
    });

    it(`stream to CSV - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: airports is ${databaseName}.table('malloytest.airports')`
        )
        .loadQuery('run: airports -> { select: code; order_by: code }')
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const csvWriter = new CSVWriter(accummulator);
      await csvWriter.process(stream);
      expect(accummulator.accumulatedValue).toBe('code\n00A\n');
    });

    it(`JSON with timestamp - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: flights is ${databaseName}.table('malloytest.flights')`
        )
        .loadQuery(
          "run: flights -> { select: dep_time; where: carrier = 'WN' and origin = 'SJC'; order_by: dep_time; limit: 1 }"
        )
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const jsonWriter = new JSONWriter(accummulator);
      await jsonWriter.process(stream);
      const result = JSON.parse(accummulator.accumulatedValue);
      expect(result.length).toBe(1);
      // Should be an ISO date string
      expect(typeof result[0].dep_time).toBe('string');
      expect(result[0].dep_time).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it(`CSV with timestamp - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: flights is ${databaseName}.table('malloytest.flights')`
        )
        .loadQuery(
          "run: flights -> { select: dep_time; where: carrier = 'WN' and origin = 'SJC'; order_by: dep_time; limit: 1 }"
        )
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const csvWriter = new CSVWriter(accummulator);
      await csvWriter.process(stream);
      const lines = accummulator.accumulatedValue.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe('dep_time');
      // Should be formatted as a date string
      expect(lines[1]).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it(`JSON with bigint - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: bigint_test is ${databaseName}.sql("SELECT CAST(19999 AS BIGINT) as big_id")`
        )
        .loadQuery('run: bigint_test -> { select: * }')
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const jsonWriter = new JSONWriter(accummulator);
      await jsonWriter.process(stream);
      const result = JSON.parse(accummulator.accumulatedValue);
      expect(result.length).toBe(1);
      // Bigint should be serialized as a string to preserve precision
      expect(typeof result[0].big_id).toBe('string');
      expect(result[0].big_id).toBe('19999');
    });

    it(`CSV with bigint - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: bigint_test is ${databaseName}.sql("SELECT CAST(19999 AS BIGINT) as big_id")`
        )
        .loadQuery('run: bigint_test -> { select: * }')
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const csvWriter = new CSVWriter(accummulator);
      await csvWriter.process(stream);
      const lines = accummulator.accumulatedValue.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe('big_id');
      // Should be a number without quotes
      expect(lines[1]).toBe('19999');
    });
  });
});
