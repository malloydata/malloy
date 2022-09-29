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

import { MarkedSource, markSource, TestTranslator } from "./test-translator";

function testHelpContext(
  source: MarkedSource,
  position: { line: number; character: number },
  type: "explore_property" | "query_property" | "model_property",
  token: string
) {
  const doc = new TestTranslator(source.code);
  expect(doc.logger.hasErrors()).toBeFalsy();
  const helpContext = doc.helpContext(position).helpContext;
  expect(helpContext).toEqual({ type, token });
}

const source = `source: foo is table('bar') {
  where: bazz ~ 'biff'
  query: foo is {
    group_by: bazz
    where: bop ~ 'blat'
  }
}

query: bar {
  group_by: bazz
}`;

test("Supports model properties", () => {
  testHelpContext(
    markSource`${source}`,
    { line: 0, character: 1 },
    "model_property",
    "source:"
  );

  testHelpContext(
    markSource`${source}`,
    { line: 8, character: 1 },
    "model_property",
    "query:"
  );
});

test("Supports explore properties", () => {
  testHelpContext(
    markSource`${source}`,
    { line: 1, character: 3 },
    "explore_property",
    "where:"
  );

  testHelpContext(
    markSource`${source}`,
    { line: 2, character: 3 },
    "explore_property",
    "query:"
  );
});

test("Supports query properties", () => {
  testHelpContext(
    markSource`${source}`,
    { line: 3, character: 5 },
    "query_property",
    "group_by:"
  );

  testHelpContext(
    markSource`${source}`,
    { line: 4, character: 5 },
    "query_property",
    "where:"
  );
});
