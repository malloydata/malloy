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

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

function sourceCodeWithFilter(filter: string) {
  return `
  source: aircraft_models is bigquery.table('malloy-data.faa.aircraft_models') {
    primary_key: aircraft_model_code
    where: ${filter}
  }

  source: aircraft is bigquery.table('malloy-data.faa.aircraft') {
    primary_key: tail_num
    measure: aircraft_count is count()
    join_one: aircraft_models with aircraft_model_code
  }

  run: aircraft -> {
    group_by: aircraft_models.aircraft_model_code
  }
`;
}

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
describe('Joined filters', () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  test('work with comma', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = sourceCodeWithFilter('1 = 1, 2 = 2');
      const result = await runtime.loadQuery(src).run();
      expect(result.sql).toContain('1=1');
      expect(result.sql).toContain('2=2');
    }
  });

  test('work with and', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = sourceCodeWithFilter('1 = 1 and 2 = 2');
      const result = await runtime.loadQuery(src).run();
      expect(result.sql).toContain('1=1');
      expect(result.sql).toContain('2=2');
    }
  });
});
