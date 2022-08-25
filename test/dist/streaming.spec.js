"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const malloy_1 = require("@malloydata/malloy");
const runtimes_1 = require("./runtimes");
const runtimes = new runtimes_1.RuntimeList(["bigquery", "postgres"]);
afterAll(async () => {
    await runtimes.closeAll();
});
class StringAccumulator {
    constructor() {
        this.accumulatedValue = "";
    }
    write(text) {
        this.accumulatedValue += text;
    }
    close() {
        return;
    }
}
runtimes.runtimeMap.forEach((runtime, databaseName) => {
    it(`basic stream test  - ${databaseName}`, async () => {
        const stream = runtime
            .loadModel(`source: airports is table('malloytest.airports') {}`)
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
            .loadModel(`source: airports is table('malloytest.airports') {}`)
            .loadQuery("query: airports -> { project: code }")
            .runStream({ rowLimit: 1 });
        const accummulator = new StringAccumulator();
        const jsonWriter = new malloy_1.JSONWriter(accummulator);
        await jsonWriter.process(stream);
        expect(accummulator.accumulatedValue).toBe(`[
  {
    "code": "1Q9"
  }
]
`);
    });
    it(`stream to CSV - ${databaseName}`, async () => {
        const stream = runtime
            .loadModel(`source: airports is table('malloytest.airports') {}`)
            .loadQuery("query: airports -> { project: code }")
            .runStream({ rowLimit: 1 });
        const accummulator = new StringAccumulator();
        const csvWriter = new malloy_1.CSVWriter(accummulator);
        await csvWriter.process(stream);
        expect(accummulator.accumulatedValue).toBe(`code\n1Q9\n`);
    });
});
//# sourceMappingURL=streaming.spec.js.map