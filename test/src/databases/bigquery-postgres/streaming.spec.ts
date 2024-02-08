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

import {
  CSVWriter,
  DataRecord,
  JSONWriter,
  WriteStream,
} from '@malloydata/malloy';
import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

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
]);

describe('Streaming tests', () => {
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
        .loadQuery('run: airports -> { select: code }')
        .runStream({rowLimit: 10});
      const rows: DataRecord[] = [];
      for await (const row of stream) {
        rows.push(row);
      }
      expect(rows.length).toBe(10);
      expect(rows[0].cell('code').string.value).toBe('1Q9');
    });

    it(`stream to JSON - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: airports is ${databaseName}.table('malloytest.airports')`
        )
        .loadQuery('run: airports -> { select: code }')
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const jsonWriter = new JSONWriter(accummulator);
      await jsonWriter.process(stream);
      expect(accummulator.accumulatedValue).toBe(
        `[
  {
    "code": "1Q9"
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
        .loadQuery('run: airports -> { select: code }')
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const csvWriter = new CSVWriter(accummulator);
      await csvWriter.process(stream);
      expect(accummulator.accumulatedValue).toBe('code\n1Q9\n');
    });

    it(`stream nested results to CSV - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(
          `source: airports is ${databaseName}.table('malloytest.airports') extend {
  rename: facility_type is fac_type

  measure: airport_count is count()

  view: by_state is {
    where: state != null
    group_by: state
    aggregate: airport_count
    limit: 2
  }

  view: by_facility_type is {
    group_by: facility_type
    aggregate:
      airport_count
    limit: 2
  }

  view: airports_by_region is {
    group_by: faa_region
    nest:
      by_state
      by_facility_type
    limit: 2
    aggregate: airport_count
  }
}`
        )
        .loadQuery('run: airports -> airports_by_region')
        .runStream({rowLimit: 1});
      const accummulator = new StringAccumulator();
      const csvWriter = new CSVWriter(accummulator);
      await csvWriter.process(stream);
      const expectedCsv = `faa_region,by_state,,by_facility_type,,airport_count
AGL,state,airport_count,facility_type,airport_count,4437
,IL,890,AIRPORT,3443,
,OH,749,HELIPORT,826,
ASW,state,airport_count,facility_type,airport_count,3268
,TX,1845,AIRPORT,2341,
,LA,500,HELIPORT,861,
`;
      expect(accummulator.accumulatedValue).toBe(expectedCsv);
    });
  });
});
