/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { CSVWriter, JSONWriter, WriteStream } from "@malloydata/malloy";
import { RuntimeList } from "../../runtimes";
import { describeIfDatabaseAvailable } from "../../util";

class StringAccumulator implements WriteStream {
  public accumulatedValue = "";

  write(text: string) {
    this.accumulatedValue += text;
  }

  close() {
    return;
  }
}

const [describe, databases] = describeIfDatabaseAvailable([
  "bigquery",
  "postgres",
]);

describe("Streaming tests", () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  runtimes.runtimeMap.forEach((runtime, databaseName) => {
    it(`basic stream test  - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(`source: airports is table('test:malloytest.airports') {}`)
        .loadQuery("query: airports -> { project: code }")
        .runStream({ rowLimit: 10 });
      const rows = [];
      for await (const row of stream) {
        rows.push(row);
      }
      expect(rows.length).toBe(10);
      expect(rows[0].cell("code").string.value).toBe("1Q9");
    });

    it(`stream to JSON - ${databaseName}`, async () => {
      const stream = runtime
        .loadModel(`source: airports is table('test:malloytest.airports') {}`)
        .loadQuery("query: airports -> { project: code }")
        .runStream({ rowLimit: 1 });
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
        .loadModel(`source: airports is table('test:malloytest.airports') {}`)
        .loadQuery("query: airports -> { project: code }")
        .runStream({ rowLimit: 1 });
      const accummulator = new StringAccumulator();
      const csvWriter = new CSVWriter(accummulator);
      await csvWriter.process(stream);
      expect(accummulator.accumulatedValue).toBe(`code\n1Q9\n`);
    });
  });
});
