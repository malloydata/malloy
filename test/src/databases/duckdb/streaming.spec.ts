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

import type {WriteStream} from '@malloydata/malloy';
import {CSVWriter, JSONWriter} from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '../../util';
import {RuntimeList} from '../../runtimes';

class StringAccumulator implements WriteStream {
  public accumulatedValue = '';

  write(text: string) {
    this.accumulatedValue += text;
  }

  close() {
    return;
  }
}

const runtimes = ['duckdb'];

const [describe, databases] = describeIfDatabaseAvailable(runtimes);

function modelText(databaseName: string) {
  return `source: airports is ${databaseName}.table('test/data/duckdb/airports.parquet') extend {
  rename: facility_type is fac_type

  measure: airport_count is count()
  measure: avg_elevation is avg(elevation)

  view: higher_elevation is {
    group_by: faa_region
    aggregate: airport_count, avg_elevation
    order_by: avg_elevation desc
    limit: 5
  }

  view: by_county is {
    where: county is not null
    group_by: county
    aggregate: airport_count
    limit: 2
    order_by: airport_count desc, county desc
  }

  view: by_state is {
    where: state is not null
    group_by: state
    aggregate: airport_count
    limit: 2
    nest: by_county
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
}`;
}

describe('Streaming tests', () => {
  if (!databases.length) {
    it.skip('skipped', () => {});
  }
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  runtimes.runtimeMap.forEach((runtime, databaseName) => {
    describe('csv', () => {
      it(`stream nested results - ${databaseName}`, async () => {
        const stream = runtime
          .loadModel(modelText(databaseName))
          .loadQuery('run: airports -> airports_by_region')
          .runStream();
        const accumulator = new StringAccumulator();
        const csvWriter = new CSVWriter(accumulator);
        await csvWriter.process(stream);
        const expectedCsv = `\
faa_region,by_state,,,,by_facility_type,,airport_count
AGL,state,airport_count,by_county,,facility_type,airport_count,4437
,IL,890,county,airport_count,AIRPORT,3443,
,,,COOK,51,HELIPORT,826,
,,,LA SALLE,39,,,
,OH,749,county,airport_count,,,
,,,FRANKLIN,27,,,
,,,CUYAHOGA,27,,,
ASW,state,airport_count,by_county,,facility_type,airport_count,3268
,TX,1845,county,airport_count,AIRPORT,2341,
,,,HARRIS,135,HELIPORT,861,
,,,TARRANT,63,,,
,LA,500,county,airport_count,,,
,,,PLAQUEMINES,31,,,
,,,VERMILION,29,,,
`;
        expect(accumulator.accumulatedValue).toBe(expectedCsv);
      });

      it(`stream simple results - ${databaseName}`, async () => {
        const stream = runtime
          .loadModel(modelText(databaseName))
          .loadQuery('run: airports -> higher_elevation')
          .runStream();
        const accumulator = new StringAccumulator();
        const csvWriter = new CSVWriter(accumulator);
        await csvWriter.process(stream);
        const expectedCsv = `\
faa_region,airport_count,avg_elevation
ANM,2102,3284.3910561370126
AWP,1503,1667.0991350632069
ACE,1579,1339.0139328689045
ASW,3268,1007.2873317013464
AGL,4437,983.4800540906018
`;
        expect(accumulator.accumulatedValue).toBe(expectedCsv);
      });
    });

    describe('json', () => {
      it(`stream nested results - ${databaseName}`, async () => {
        const stream = runtime
          .loadModel(modelText(databaseName))
          .loadQuery('run: airports -> airports_by_region')
          .runStream();
        const accumulator = new StringAccumulator();
        const jsonWriter = new JSONWriter(accumulator);
        await jsonWriter.process(stream);
        const expectedJson = `\
[
  {
    "faa_region": "AGL",
    "by_state": [
      {
        "state": "IL",
        "airport_count": 890,
        "by_county": [
          {
            "county": "COOK",
            "airport_count": 51
          },
          {
            "county": "LA SALLE",
            "airport_count": 39
          }
        ]
      },
      {
        "state": "OH",
        "airport_count": 749,
        "by_county": [
          {
            "county": "FRANKLIN",
            "airport_count": 27
          },
          {
            "county": "CUYAHOGA",
            "airport_count": 27
          }
        ]
      }
    ],
    "by_facility_type": [
      {
        "facility_type": "AIRPORT",
        "airport_count": 3443
      },
      {
        "facility_type": "HELIPORT",
        "airport_count": 826
      }
    ],
    "airport_count": 4437
  },
  {
    "faa_region": "ASW",
    "by_state": [
      {
        "state": "TX",
        "airport_count": 1845,
        "by_county": [
          {
            "county": "HARRIS",
            "airport_count": 135
          },
          {
            "county": "TARRANT",
            "airport_count": 63
          }
        ]
      },
      {
        "state": "LA",
        "airport_count": 500,
        "by_county": [
          {
            "county": "PLAQUEMINES",
            "airport_count": 31
          },
          {
            "county": "VERMILION",
            "airport_count": 29
          }
        ]
      }
    ],
    "by_facility_type": [
      {
        "facility_type": "AIRPORT",
        "airport_count": 2341
      },
      {
        "facility_type": "HELIPORT",
        "airport_count": 861
      }
    ],
    "airport_count": 3268
  }
]
`;
        expect(accumulator.accumulatedValue).toBe(expectedJson);
      });

      it(`stream simple results - ${databaseName}`, async () => {
        const stream = runtime
          .loadModel(modelText(databaseName))
          .loadQuery('run: airports -> higher_elevation')
          .runStream();
        const accumulator = new StringAccumulator();
        const jsonWriter = new JSONWriter(accumulator);
        await jsonWriter.process(stream);
        const expectedJson = `\
[
  {
    "faa_region": "ANM",
    "airport_count": 2102,
    "avg_elevation": 3284.3910561370126
  },
  {
    "faa_region": "AWP",
    "airport_count": 1503,
    "avg_elevation": 1667.0991350632069
  },
  {
    "faa_region": "ACE",
    "airport_count": 1579,
    "avg_elevation": 1339.0139328689045
  },
  {
    "faa_region": "ASW",
    "airport_count": 3268,
    "avg_elevation": 1007.2873317013464
  },
  {
    "faa_region": "AGL",
    "airport_count": 4437,
    "avg_elevation": 983.4800540906018
  }
]
`;
        expect(accumulator.accumulatedValue).toBe(expectedJson);
      });
    });
  });
});
