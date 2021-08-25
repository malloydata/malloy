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

import "./jestery";
import { MalloyTranslator } from "./parse-malloy";
import { TestTranslator } from "./jest-factories";

function getHighlight(
  trans: MalloyTranslator,
  line: number,
  character: number
) {
  const explore = trans.metadata();
  expect(trans).toBeErrorless();
  expect(explore?.highlights).toBeDefined();
  if (explore.highlights) {
    const found = explore.highlights.find((highlight) => {
      return (
        highlight.range.start.line <= line &&
        highlight.range.end.line >= line &&
        (line !== highlight.range.start.line ||
          character >= highlight.range.start.character) &&
        (line !== highlight.range.end.line ||
          character <= highlight.range.end.character)
      );
    });
    return found;
  }
  return {};
}

test("table name should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights');"
  );
  expect(getHighlight(doc, 0, 27)).toMatchObject({
    type: "literal.string",
    range: {
      start: { line: 0, character: 26 },
      end: { line: 0, character: 44 },
    },
  });
});

test("export should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights');"
  );
  expect(getHighlight(doc, 0, 1)).toMatchObject({
    type: "keyword.export",
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 6 },
    },
  });
});

test("define should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights');"
  );
  expect(getHighlight(doc, 0, 12)).toMatchObject({
    type: "keyword.define",
    range: {
      start: { line: 0, character: 7 },
      end: { line: 0, character: 13 },
    },
  });
});

test("import should be highlighted", () => {
  const doc = new TestTranslator('import "foo"');
  expect(getHighlight(doc, 0, 0)).toMatchObject({
    type: "keyword.import",
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 6 },
    },
  });
});

test("name of explore should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights');"
  );
  expect(getHighlight(doc, 0, 15)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 0, character: 14 },
      end: { line: 0, character: 21 },
    },
  });
});

test("name only definitions should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  my_type is table_type\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 3)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 9 },
    },
  });
  expect(getHighlight(doc, 1, 19)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 13 },
      end: { line: 1, character: 23 },
    },
  });
});

test("expression definitions should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  two is 1 + 1\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 3)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 5 },
    },
  });
});

test("turtle definitions should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  my_turtle is (reduce thing)\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 3)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 11 },
    },
  });
});

test("rename definitions should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  new_thing renames thing\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 3)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 11 },
    },
  });
  expect(getHighlight(doc, 1, 21)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 20 },
      end: { line: 1, character: 25 },
    },
  });
  expect(getHighlight(doc, 1, 12)).toMatchObject({
    type: "keyword.renames",
    range: {
      start: { line: 1, character: 12 },
      end: { line: 1, character: 19 },
    },
  });
});

test("join definitions should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  a is join b on c\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 2)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 3 },
    },
  });
  expect(getHighlight(doc, 1, 12)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 12 },
      end: { line: 1, character: 13 },
    },
  });
  expect(getHighlight(doc, 1, 17)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 17 },
      end: { line: 1, character: 18 },
    },
  });
});

test("join on in joins section should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  joins\n" +
      "    b on c\n" +
      ");\n"
  );
  expect(getHighlight(doc, 2, 5)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 2, character: 4 },
      end: { line: 2, character: 5 },
    },
  });
  expect(getHighlight(doc, 2, 9)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 2, character: 9 },
      end: { line: 2, character: 10 },
    },
  });
});

test("join source in joins section should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  joins\n" +
      "    a is b on c\n" +
      ");\n"
  );
  expect(getHighlight(doc, 2, 4)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 2, character: 4 },
      end: { line: 2, character: 5 },
    },
  });
  expect(getHighlight(doc, 2, 9)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 2, character: 9 },
      end: { line: 2, character: 10 },
    },
  });
  expect(getHighlight(doc, 2, 14)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 2, character: 14 },
      end: { line: 2, character: 15 },
    },
  });
});

test("fields listed in explore should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" + "  one, two\n" + ");\n"
  );
  expect(getHighlight(doc, 1, 3)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 5 },
    },
  });
  expect(getHighlight(doc, 1, 8)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 7 },
      end: { line: 1, character: 10 },
    },
  });
});

test("fields listed in index stage should be highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  my_index is (index\n" +
      "    a, b on d\n" +
      "  )\n" +
      ");\n"
  );
  expect(getHighlight(doc, 2, 4)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 2, character: 4 },
      end: { line: 2, character: 5 },
    },
  });
  expect(getHighlight(doc, 2, 7)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 2, character: 7 },
      end: { line: 2, character: 8 },
    },
  });
  expect(getHighlight(doc, 2, 12)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 2, character: 12 },
      end: { line: 2, character: 13 },
    },
  });
  expect(getHighlight(doc, 1, 15)).toMatchObject({
    type: "transformation.index",
    range: {
      start: { line: 1, character: 15 },
      end: { line: 1, character: 20 },
    },
  });
});

test("field used in expression is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  two is one + one\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 9)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 9 },
      end: { line: 1, character: 12 },
    },
  });
});

test("aggregate is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  flight_count is count()\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 18)).toMatchObject({
    type: "call.aggregate",
    range: {
      start: { line: 1, character: 18 },
      end: { line: 1, character: 23 },
    },
  });
});

test("type is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  one is 1::number\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 12)).toMatchObject({
    type: "type",
    range: {
      start: { line: 1, character: 12 },
      end: { line: 1, character: 18 },
    },
  });
});

test("literal date is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  dt is @2020\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 8)).toMatchObject({
    type: "literal.date",
    range: {
      start: { line: 1, character: 8 },
      end: { line: 1, character: 13 },
    },
  });
});

test("timeframe extraction is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  dt is hour(@2020)\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 8)).toMatchObject({
    type: "call.time_frame",
    range: {
      start: { line: 1, character: 8 },
      end: { line: 1, character: 12 },
    },
  });
});

test("timeframe truncation is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  dt is @2020.hour\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 14)).toMatchObject({
    type: "call.time_frame",
    range: {
      start: { line: 1, character: 14 },
      end: { line: 1, character: 18 },
    },
  });
});

test("function call is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  num is round(1.0123)\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 9)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 9 },
      end: { line: 1, character: 14 },
    },
  });
});

test("primary key is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is ('my.table.flights'\n" +
      "  primary key id\n" +
      ");\n"
  );
  expect(getHighlight(doc, 1, 14)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 14 },
      end: { line: 1, character: 16 },
    },
  });
  expect(getHighlight(doc, 1, 2)).toMatchObject({
    type: "keyword.primary",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 9 },
    },
  });
  expect(getHighlight(doc, 1, 10)).toMatchObject({
    type: "keyword.key",
    range: {
      start: { line: 1, character: 10 },
      end: { line: 1, character: 13 },
    },
  });
});

test("named source is highlighted", () => {
  const doc = new TestTranslator("export define flights is (flights_old);");
  expect(getHighlight(doc, 0, 26)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 0, character: 26 },
      end: { line: 0, character: 37 },
    },
  });
});

test("aggregated field is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is (source\n" +
      "  counted_thing is count(thing)\n" +
      "  counted is count(*)\n" +
      ");"
  );
  expect(getHighlight(doc, 1, 25)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 25 },
      end: { line: 1, character: 30 },
    },
  });
});

test("count distinct is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is (source\n" +
      "  counted_thing is count(distinct thing)\n" +
      ");"
  );
  expect(getHighlight(doc, 1, 34)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 34 },
      end: { line: 1, character: 39 },
    },
  });
  expect(getHighlight(doc, 1, 25)).toMatchObject({
    type: "keyword.aggregate_modifier.distinct",
    range: {
      start: { line: 1, character: 25 },
      end: { line: 1, character: 33 },
    },
  });
});

test("ordered by field is highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is (source\n" +
      "  my_turtle is (reduce carrier order by carrier asc)\n" +
      ");"
  );
  expect(getHighlight(doc, 1, 40)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 40 },
      end: { line: 1, character: 47 },
    },
  });
});

test("accepted fields are highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is (source\n" + "  accept a, b\n" + ");"
  );
  expect(getHighlight(doc, 1, 9)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 9 },
      end: { line: 1, character: 10 },
    },
  });
  expect(getHighlight(doc, 1, 12)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 12 },
      end: { line: 1, character: 13 },
    },
  });
  expect(getHighlight(doc, 1, 2)).toMatchObject({
    type: "keyword.accept",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 8 },
    },
  });
});

test("excepted fields are highlighted", () => {
  const doc = new TestTranslator(
    "export define flights is (source\n" + "  except a, b\n" + ");"
  );
  expect(getHighlight(doc, 1, 9)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 9 },
      end: { line: 1, character: 10 },
    },
  });
  expect(getHighlight(doc, 1, 12)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 1, character: 12 },
      end: { line: 1, character: 13 },
    },
  });
  expect(getHighlight(doc, 1, 2)).toMatchObject({
    type: "keyword.except",
    range: {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 8 },
    },
  });
});

test("explore is highlighted", () => {
  const doc = new TestTranslator("explore flights | reduce flight_count");
  expect(getHighlight(doc, 0, 0)).toMatchObject({
    type: "keyword.explore",
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 7 },
    },
  });
});

test("string literal is highlighted", () => {
  const doc = new TestTranslator("explore flights | reduce a is 'foo'");
  expect(getHighlight(doc, 0, 30)).toMatchObject({
    type: "literal.string",
    range: {
      start: { line: 0, character: 30 },
      end: { line: 0, character: 35 },
    },
  });
});

test("json string literal is highlighted", () => {
  const doc = new TestTranslator('define foo is json { "foo": 1 }');
  expect(getHighlight(doc, 0, 21)).toMatchObject({
    type: "literal.string",
    range: {
      start: { line: 0, character: 21 },
      end: { line: 0, character: 26 },
    },
  });
  expect(getHighlight(doc, 0, 14)).toMatchObject({
    type: "keyword.json",
    range: {
      start: { line: 0, character: 14 },
      end: { line: 0, character: 18 },
    },
  });
});

test("number literals are highlighted", () => {
  const doc = new TestTranslator("explore a | reduce b is 1, c is 1.123");
  expect(getHighlight(doc, 0, 24)).toMatchObject({
    type: "literal.number",
    range: {
      start: { line: 0, character: 24 },
      end: { line: 0, character: 25 },
    },
  });
  expect(getHighlight(doc, 0, 32)).toMatchObject({
    type: "literal.number",
    range: {
      start: { line: 0, character: 32 },
      end: { line: 0, character: 37 },
    },
  });
});

test("regular expression literals are highlighted", () => {
  const doc = new TestTranslator("explore a | reduce b is r'a', c is /'b'");
  expect(getHighlight(doc, 0, 24)).toMatchObject({
    type: "literal.regular_expression",
    range: {
      start: { line: 0, character: 24 },
      end: { line: 0, character: 28 },
    },
  });
  expect(getHighlight(doc, 0, 35)).toMatchObject({
    type: "literal.regular_expression",
    range: {
      start: { line: 0, character: 35 },
      end: { line: 0, character: 39 },
    },
  });
});

test("reduce is highlighted", () => {
  const doc = new TestTranslator("explore a | reduce b");
  expect(getHighlight(doc, 0, 12)).toMatchObject({
    type: "transformation.reduce",
    range: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 18 },
    },
  });
});

test("project is highlighted", () => {
  const doc = new TestTranslator("explore a | project b");
  expect(getHighlight(doc, 0, 12)).toMatchObject({
    type: "transformation.project",
    range: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 19 },
    },
  });
});

test("index is highlighted", () => {
  const doc = new TestTranslator("explore a | index b");
  expect(getHighlight(doc, 0, 12)).toMatchObject({
    type: "transformation.index",
    range: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 17 },
    },
  });
});

test("is is highlighted", () => {
  const doc = new TestTranslator("a | reduce b is 1");
  expect(getHighlight(doc, 0, 13)).toMatchObject({
    type: "keyword.is",
    range: {
      start: { line: 0, character: 13 },
      end: { line: 0, character: 15 },
    },
  });
});

test("top is highlighted", () => {
  const doc = new TestTranslator("a | reduce top 1 b");
  expect(getHighlight(doc, 0, 11)).toMatchObject({
    type: "keyword.top",
    range: {
      start: { line: 0, character: 11 },
      end: { line: 0, character: 14 },
    },
  });
});

test("order by is highlighted", () => {
  const doc = new TestTranslator("a | reduce order by 1 b");
  expect(getHighlight(doc, 0, 11)).toMatchObject({
    type: "keyword.order",
    range: {
      start: { line: 0, character: 11 },
      end: { line: 0, character: 16 },
    },
  });
  expect(getHighlight(doc, 0, 17)).toMatchObject({
    type: "keyword.by",
    range: {
      start: { line: 0, character: 17 },
      end: { line: 0, character: 19 },
    },
  });
});

test("limit is highlighted", () => {
  const doc = new TestTranslator("a | reduce limit 1 b");
  expect(getHighlight(doc, 0, 11)).toMatchObject({
    type: "keyword.limit",
    range: {
      start: { line: 0, character: 11 },
      end: { line: 0, character: 16 },
    },
  });
});

test("labels are highlighted", () => {
  const doc = new TestTranslator(
    "a is (flights\n" + "fields a\n" + "joins b on c\n" + ");"
  );
  expect(getHighlight(doc, 1, 0)).toMatchObject({
    type: "label.fields",
    range: {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 6 },
    },
  });
  expect(getHighlight(doc, 2, 0)).toMatchObject({
    type: "label.joins",
    range: {
      start: { line: 2, character: 0 },
      end: { line: 2, character: 5 },
    },
  });
});

test.skip("join and on are highlighted", () => {
  const doc = new TestTranslator("a is (flights\n" + "join a on b\n" + ");");
  expect(getHighlight(doc, 1, 0)).toMatchObject({
    type: "keyword.join",
    range: {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 4 },
    },
  });
  expect(getHighlight(doc, 1, 7)).toMatchObject({
    type: "keyword.on",
    range: {
      start: { line: 1, character: 7 },
      end: { line: 1, character: 9 },
    },
  });
});

test("define is highlighted", () => {
  const doc = new TestTranslator("define a is (b);");
  expect(getHighlight(doc, 0, 0)).toMatchObject({
    type: "keyword.define",
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 6 },
    },
  });
});

test("export define is highlighted", () => {
  const doc = new TestTranslator("define a is (b);");
  expect(getHighlight(doc, 0, 0)).toMatchObject({
    type: "keyword.define",
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 6 },
    },
  });
});

test("desc is highlighted", () => {
  const doc = new TestTranslator("a | reduce order by 1 desc b");
  expect(getHighlight(doc, 0, 22)).toMatchObject({
    type: "keyword.desc",
    range: {
      start: { line: 0, character: 22 },
      end: { line: 0, character: 26 },
    },
  });
});

test("asc is highlighted", () => {
  const doc = new TestTranslator("a | reduce order by 1 asc b");
  expect(getHighlight(doc, 0, 22)).toMatchObject({
    type: "keyword.asc",
    range: {
      start: { line: 0, character: 22 },
      end: { line: 0, character: 25 },
    },
  });
});

test("cast as is highlighted", () => {
  const doc = new TestTranslator("a | reduce a is cast(b as number)");
  expect(getHighlight(doc, 0, 16)).toMatchObject({
    type: "call.cast",
    range: {
      start: { line: 0, character: 16 },
      end: { line: 0, character: 20 },
    },
  });
  expect(getHighlight(doc, 0, 23)).toMatchObject({
    type: "keyword.cast_modifier.as",
    range: {
      start: { line: 0, character: 23 },
      end: { line: 0, character: 25 },
    },
  });
});

test("pick when else is highlighted", () => {
  const doc = new TestTranslator("a | reduce a is pick 1 when true else 0");
  expect(getHighlight(doc, 0, 16)).toMatchObject({
    type: "keyword.pick",
    range: {
      start: { line: 0, character: 16 },
      end: { line: 0, character: 20 },
    },
  });
  expect(getHighlight(doc, 0, 23)).toMatchObject({
    type: "keyword.when",
    range: {
      start: { line: 0, character: 23 },
      end: { line: 0, character: 27 },
    },
  });
  expect(getHighlight(doc, 0, 33)).toMatchObject({
    type: "keyword.else",
    range: {
      start: { line: 0, character: 33 },
      end: { line: 0, character: 37 },
    },
  });
});

test("turtle is highlighted", () => {
  const doc = new TestTranslator("a | reduce b is turtle (reduce c)");
  expect(getHighlight(doc, 0, 16)).toMatchObject({
    type: "keyword.turtle",
    range: {
      start: { line: 0, character: 16 },
      end: { line: 0, character: 22 },
    },
  });
});

test("booleans are highlighted", () => {
  const doc = new TestTranslator("a | reduce a is true, b is false");
  expect(getHighlight(doc, 0, 16)).toMatchObject({
    type: "literal.boolean",
    range: {
      start: { line: 0, character: 16 },
      end: { line: 0, character: 20 },
    },
  });
  expect(getHighlight(doc, 0, 27)).toMatchObject({
    type: "literal.boolean",
    range: {
      start: { line: 0, character: 27 },
      end: { line: 0, character: 32 },
    },
  });
});

test("now is highlighted", () => {
  const doc = new TestTranslator("a | reduce b is now");
  expect(getHighlight(doc, 0, 16)).toMatchObject({
    type: "literal.date",
    range: {
      start: { line: 0, character: 16 },
      end: { line: 0, character: 19 },
    },
  });
});

test("null is highlighted", () => {
  const doc = new TestTranslator("a | reduce b is null");
  expect(getHighlight(doc, 0, 16)).toMatchObject({
    type: "literal.null",
    range: {
      start: { line: 0, character: 16 },
      end: { line: 0, character: 20 },
    },
  });
});

test("boolean operators are highlighted", () => {
  const doc = new TestTranslator("a | reduce b is not (a and (b or c))");
  expect(getHighlight(doc, 0, 16)).toMatchObject({
    type: "operator.boolean",
    range: {
      start: { line: 0, character: 16 },
      end: { line: 0, character: 19 },
    },
  });
  expect(getHighlight(doc, 0, 23)).toMatchObject({
    type: "operator.boolean",
    range: {
      start: { line: 0, character: 23 },
      end: { line: 0, character: 26 },
    },
  });
  expect(getHighlight(doc, 0, 30)).toMatchObject({
    type: "operator.boolean",
    range: {
      start: { line: 0, character: 30 },
      end: { line: 0, character: 32 },
    },
  });
});

test("line comments are highlighted", () => {
  const doc = new TestTranslator("explore a | reduce b -- comment");
  expect(getHighlight(doc, 0, 21)).toMatchObject({
    type: "comment.line",
    range: {
      start: { line: 0, character: 21 },
      end: { line: 0, character: 31 },
    },
  });
});

test("block comments are highlighted", () => {
  const doc = new TestTranslator(
    "explore a | reduce b /* comment\n" + "more comment */ c"
  );
  expect(getHighlight(doc, 0, 21)).toMatchObject({
    type: "comment.block",
    range: {
      start: { line: 0, character: 21 },
      end: { line: 1, character: 15 },
    },
  });
});

test("for is highlighted", () => {
  const doc = new TestTranslator("explore a | reduce b is c for 3 days");
  expect(getHighlight(doc, 0, 26)).toMatchObject({
    type: "operator.date",
    range: {
      start: { line: 0, character: 26 },
      end: { line: 0, character: 29 },
    },
  });
});

test("bare field in explore is highlighted", () => {
  const doc = new TestTranslator("explore a | cool_query");
  expect(getHighlight(doc, 0, 13)).toMatchObject({
    type: "identifier",
    range: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 22 },
    },
  });
});
