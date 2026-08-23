/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DataRecord, WriteStream} from '@malloydata/malloy';
import {CSVWriter, JSONWriter} from '@malloydata/malloy';
import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import {TestSelect} from '../../test-select';

class StringAccumulator implements WriteStream {
  public accumulatedValue = '';

  write(text: string) {
    this.accumulatedValue += text;
  }

  close() {
    return;
  }
}

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  // Streaming is an optional connection capability (StreamingConnection).
  // Dialects which do not implement it skip rather than fail.
  const streams = runtime.connection.canStream();

  // TestSelect quotes the column alias per dialect, so the name survives
  // Snowflake's folding of unquoted identifiers to upper case.
  const ts = new TestSelect(runtime.dialect);
  const bigintSQL = ts.generate({big_id: ts.mk_bigint(19999)});

  test.when(streams)(`basic stream test  - ${databaseName}`, async () => {
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

  test.when(streams)(`stream to JSON - ${databaseName}`, async () => {
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

  test.when(streams)(`stream to CSV - ${databaseName}`, async () => {
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

  test.when(streams)(`JSON with timestamp - ${databaseName}`, async () => {
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
    expect(result[0].dep_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test.when(streams)(`CSV with timestamp - ${databaseName}`, async () => {
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

  test.when(streams)(`JSON with bigint - ${databaseName}`, async () => {
    const stream = runtime
      .loadModel(
        `source: bigint_test is ${databaseName}.sql("""${bigintSQL}""")`
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

  test.when(streams)(`CSV with bigint - ${databaseName}`, async () => {
    const stream = runtime
      .loadModel(
        `source: bigint_test is ${databaseName}.sql("""${bigintSQL}""")`
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
