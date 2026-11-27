/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DataRecord, WriteStream} from '@malloydata/malloy';
import {CSVWriter, JSONWriter} from '@malloydata/malloy';
import {testDatabase} from '../test_database';
import {TestSelect} from '../test_tools/test_select';

class StringAccumulator implements WriteStream {
  public accumulatedValue = '';

  write(text: string) {
    this.accumulatedValue += text;
  }

  close() {
    return;
  }
}

afterAll(() => testDatabase.shutdown());

// Streaming is an optional connection capability (StreamingConnection).
// Databases whose connections do not implement it skip rather than fail.
const streams = testDatabase.canStream;
const runtime = testDatabase.runtime;

// TestSelect quotes the column alias per dialect, so the name survives
// Snowflake's folding of unquoted identifiers to upper case.
const ts = new TestSelect(testDatabase.dialect);
const bigintSQL = ts.generate({big_id: ts.mk_bigint(19999)});

test.when(streams)('basic stream test', async () => {
  const stream = runtime
    .loadModel("source: airports is db.table('malloytest.airports')")
    .loadQuery('run: airports -> { select: code; order_by: code }')
    .runStream({rowLimit: 10});
  const rows: DataRecord[] = [];
  for await (const row of stream) {
    rows.push(row);
  }
  expect(rows.length).toBe(10);
  expect(rows[0].cell('code').string.value).toBe('00A');
});

test.when(streams)('stream to JSON', async () => {
  const stream = runtime
    .loadModel("source: airports is db.table('malloytest.airports')")
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

test.when(streams)('stream to CSV', async () => {
  const stream = runtime
    .loadModel("source: airports is db.table('malloytest.airports')")
    .loadQuery('run: airports -> { select: code; order_by: code }')
    .runStream({rowLimit: 1});
  const accummulator = new StringAccumulator();
  const csvWriter = new CSVWriter(accummulator);
  await csvWriter.process(stream);
  expect(accummulator.accumulatedValue).toBe('code\n00A\n');
});

test.when(streams)('JSON with timestamp', async () => {
  const stream = runtime
    .loadModel("source: flights is db.table('malloytest.flights')")
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
  expect(result[0].dep_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test.when(streams)('CSV with timestamp', async () => {
  const stream = runtime
    .loadModel("source: flights is db.table('malloytest.flights')")
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

test.when(streams)('JSON with bigint', async () => {
  const stream = runtime
    .loadModel(`source: bigint_test is db.sql("""${bigintSQL}""")`)
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

test.when(streams)('CSV with bigint', async () => {
  const stream = runtime
    .loadModel(`source: bigint_test is db.sql("""${bigintSQL}""")`)
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
