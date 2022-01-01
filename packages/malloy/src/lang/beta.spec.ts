/*
 * Copyright 2021 Google LLC
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

import { mkStruct, TestTranslator } from "./jest-factories";

function malloy(s: string): TestTranslator {
  return new TestTranslator(s);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      astToBe(fmtAst: string): R;
    }
  }
}

expect.extend({
  astToBe: function (x: TestTranslator, fmtAst: string) {
    return {
      message: () => "Did not match expected ast",
      pass: false,
    };
  },
});

describe("explore", () => {
  test("define one explore", () => {
    const doc = malloy(`explore: testA is 'aTable`);
    expect(doc).astToBe(`
			document:
				explore: name=A
		`);
    expect(doc.exploreFor("testA")).toEqual(mkStruct("testA"));
  });
});
