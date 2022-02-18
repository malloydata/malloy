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

import { MarkedSource, markSource, TestTranslator } from "./test-translator";
import { DocumentSymbol } from "../parse-tree-walkers/document-symbol-walker";

class MalloyExplore extends TestTranslator {
  constructor(src: string) {
    super(src);
  }

  get symbols(): DocumentSymbol[] {
    const md = this.metadata();
    return md.symbols || [];
  }
}

function testSymbol(source: MarkedSource, name: string,  type: string, path: number[]) {
  const doc = new MalloyExplore(
    source.code
  );
  let current = { children: doc.symbols };
  path.forEach((segment) => {
    current = current.children[segment];
  });
  expect(doc.logger.hasErrors()).toBeFalsy();
  expect(current).toMatchObject(
    {
      name,
      range: source.locations[0].range,
      type,
    },
  );
}

test("explore symbols are included", () => {
  testSymbol(
    markSource`explore: ${"flights is table('my.table.flights')"}`,
    "flights",
    "explore",
    [0]
  );
});

test("query symbols are included", () => {
  testSymbol(
    markSource`query: ${"flights_by_carrier is flights -> by_carrier"}`,
    "flights_by_carrier",
    "query",
    [0]
  );
});

test("expression field defs are included", () => {
  testSymbol(
    markSource`
      explore: flights is table('my.table.flights') {
        dimension: ${"one is 1"}
      }
    `,
    "one",
    "field",
    [0, 0]
  );
});

test("renamed fields are included", () => {
  testSymbol(
    markSource`
      explore: flights is table('my.table.flights') {
        rename: ${"field_two is field_2"}
      }
    `,
    "field_two",
    "field",
    [0, 0]
  );
});

test("name only fields are included", () => {
  testSymbol(
    markSource`
      explore: flights is table('my.table.flights') {
        dimension: ${"field_two is field_2"}
      }
    `,
    "field_two",
    "field",
    [0, 0]
  );
});

test("turtle fields are included", () => {
  testSymbol(
    markSource`
      explore: flights is table('my.table.flights') {
        query: ${"my_turtle is { group_by: a }"}
      }
    `,
    "my_turtle",
    "query",
    [0, 0]
  );
});

test("turtle children fields are included", () => {
  testSymbol(
    markSource`
      explore: flights is table('my.table.flights') {
        query: my_turtle is { group_by: ${"a"} }
      }
    `,
    "a",
    "field",
    [0, 0, 0]
  );
});

test("turtle children turtles are included", () => {
  testSymbol(
    markSource`
      explore: flights is table('my.table.flights') {
        query: my_turtle is { nest: ${"inner_turtle is { group_by: a }"} }
      }
    `,
    "inner_turtle",
    "query",
    [0, 0, 0]
  );
});

test("join withs are included", () => {
  testSymbol(
    markSource`
      explore: flights is table('my.table.flights') {
        join_one: ${"a is b with c"}
      }
    `,
    "a",
    "join",
    [0, 0]
  );
});

test("join ons are included", () => {
  testSymbol(
    markSource`
      explore: flights is table('my.table.flights') {
        join_one: ${"a is b on c"}
      }
    `,
    "a",
    "join",
    [0, 0]
  );
});
