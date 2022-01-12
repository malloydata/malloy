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

import { TestTranslator } from "../jest-factories";
import { DocumentSymbol } from "./document-symbol-walker";

class MalloyExplore {
  tt: TestTranslator;
  constructor(src: string) {
    this.tt = new TestTranslator(src);
  }

  get symbols(): DocumentSymbol[] {
    const md = this.tt.metadata();
    return md.symbols || [];
  }
}

test("explore symbols are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights');"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [],
      name: "flights",
      range: {
        end: { line: 0, character: 53 },
        start: { line: 0, character: 0 },
      },
      type: "explore",
    },
  ]);
});

test("query symbols are included", () => {
  const doc = new MalloyExplore(
    "flights_by_carrier is (flights | by_carrier);"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [],
      name: "flights_by_carrier",
      range: {
        end: { line: 0, character: 44 },
        start: { line: 0, character: 0 },
      },
      type: "query",
    },
  ]);
});

test("expression field defs are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  one is 1\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "one",
          range: {
            start: { line: 1, character: 2 },
            end: { line: 1, character: 10 },
          },
          type: "field",
        },
      ],
      name: "flights",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 1 },
      },
      type: "explore",
    },
  ]);
});

test("renamed fields are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  field_two renames field_2\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "field_two",
          range: {
            start: { line: 1, character: 2 },
            end: { line: 1, character: 27 },
          },
          type: "field",
        },
      ],
      name: "flights",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 1 },
      },
      type: "explore",
    },
  ]);
});

test("name only fields are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  field_two is field_2\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "field_two",
          range: {
            start: { line: 1, character: 2 },
            end: { line: 1, character: 22 },
          },
          type: "field",
        },
      ],
    },
  ]);
});

test("turtle fields are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  my_turtle is (reduce a)\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "my_turtle",
          range: {
            start: { line: 1, character: 2 },
            end: { line: 1, character: 25 },
          },
          type: "turtle",
        },
      ],
    },
  ]);
});

test("turtle children fields are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  my_turtle is (reduce a)\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "my_turtle",
          children: [
            {
              name: "a",
              range: {
                start: { line: 1, character: 23 },
                end: { line: 1, character: 24 },
              },
              type: "field",
            },
          ],
        },
      ],
    },
  ]);
});

test("turtle children turtles are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  my_turtle is (reduce inner_turtle is (reduce a))\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "my_turtle",
          children: [
            {
              name: "inner_turtle",
              range: {
                start: { line: 1, character: 23 },
                end: { line: 1, character: 49 },
              },
              type: "turtle",
              children: [
                {
                  name: "a",
                  range: {
                    start: { line: 1, character: 47 },
                    end: { line: 1, character: 48 },
                  },
                  type: "field",
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
});

test("joins are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  a is join b on c\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "a",
          range: {
            start: { line: 1, character: 2 },
            end: { line: 1, character: 18 },
          },
          type: "join",
        },
      ],
    },
  ]);
});

test("join ons in join section are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  joins a on b\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "a",
          range: {
            start: { line: 1, character: 8 },
            end: { line: 1, character: 14 },
          },
          type: "join",
        },
      ],
    },
  ]);
});

test("join sources in join section are included", () => {
  const doc = new MalloyExplore(
    "export define flights is (explore 'my.table.flights'\n" +
      "  joins a is b on c\n" +
      ");"
  );
  expect(doc.symbols).toMatchObject([
    {
      children: [
        {
          name: "a",
          range: {
            start: { line: 1, character: 8 },
            end: { line: 1, character: 19 },
          },
          type: "join",
        },
      ],
    },
  ]);
});
