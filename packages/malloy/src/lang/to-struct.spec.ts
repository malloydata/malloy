/* eslint-disable no-console */
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
import * as model from "../model/malloy_types";
import { Malloy } from "../malloy";
import {
  aTableDef,
  mkQuery,
  mkStruct,
  mkFilters,
  mkCountDef,
  exploreFor,
  mkAgg,
  pretty,
  TestTranslator,
} from "./jest-factories";
import * as ast from "./ast";
import { FieldSpace } from "./field-space";
import { NeedSchemaData } from "./parse-malloy";

function findField(
  struct: model.NamedMalloyObject | undefined,
  fn: string
): model.FieldDef | undefined {
  if (struct && struct.type === "struct") {
    return struct.fields.find((f) => (f.as || f.name) === fn);
  }
}

function queryForExplore(exploreSource: string): model.Query {
  const x = new TestTranslator(exploreSource, "explore");
  expect(x).toTranslate();
  const exploreAst = x.ast();
  if (exploreAst instanceof ast.Explore) {
    return exploreAst.query();
  }
  throw new Error(
    `SOURCE:\n` +
      `${exploreSource}\n\n` +
      `Expected source to parse to an explore => ${pretty(exploreAst)}`
  );
}

function sourceStructFromExplore(exploreSource: string): model.StructDef {
  const x = new TestTranslator(exploreSource, "explore");
  expect(x).toTranslate();
  const exploreAst = x.ast();
  if (exploreAst instanceof ast.Explore) {
    return exploreAst.structDef();
  }
  throw new Error(
    `SOURCE:\n` +
      `${exploreSource}\n\n` +
      `Expected source to parse to an explore => ${pretty(exploreAst)}`
  );
}

function translatedModel(docSource: string): model.ModelDef {
  const x = new TestTranslator(docSource, "malloyDocument");
  expect(x).toTranslate();
  const tr = x.translate();
  if (tr.translated) {
    return tr.translated.modelDef;
  }
  throw new Error("cannot get here");
}

function fieldDefFromExpression(expr: string): model.FieldTypeDef {
  const exprParse = new TestTranslator(expr, "fieldExpr");
  const exprAst = exprParse.ast();
  expect(exprParse).toTranslate();
  expect(exprAst).toBeInstanceOf(ast.ExpressionDef);
  if (exprAst instanceof ast.ExpressionDef) {
    const aSpace = new FieldSpace(mkStruct("a"));
    const fakeDef = new ast.ExpressionFieldDef(
      exprAst,
      new ast.FieldName("test")
    );
    const field = fakeDef.fieldDef(aSpace, "test");
    expect(exprParse).toTranslate();
    return field;
  }
  fail("test harness expression parser failed");
}

function mkFieldFrag(fn: string): model.FieldFragment {
  return { type: "field", path: fn };
}

/*
 * Tests run in a world where 'aTable' exists and has columns 'astring',
 * 'aninteger', 'afloat', 'adate', 'atimestamp'
 *
 * And the model is:
 *   define a is ('aTable' primary key astring)
 *   define b is ('aTable' primary key astring)
 */

describe("explore", () => {
  test("bare explore a", () => {
    expect("explore a").toMakeQuery(mkQuery(mkStruct("a")));
  });

  test("explore-omitted a", () => {
    expect("a").toMakeQuery(mkQuery(mkStruct("a")));
  });

  test("explore table", () => {
    expect("explore 'aTable'").toMakeQuery(mkQuery(aTableDef));
  });

  test("explore a FIELDDEF", () => {
    const aEx = mkStruct("a");
    aEx.fields.push({
      type: "string",
      name: "sauce",
      e: ["'a1'"],
      source: "'a1'",
    });
    expect("explore a sauce is 'a1'").toMakeQuery(mkQuery(aEx));
  });

  test("explore a primary key", () => {
    expect("a primary key aninteger").toMakeQuery(
      mkQuery(mkStruct("a", "aninteger"))
    );
  });

  test("explore a : [ a:'filter' ]", () => {
    expect("a : [ astring:'avalue' ]").toMakeQuery({
      ...mkQuery(mkStruct("a")),
      filterList: mkFilters("astring", "avalue"),
    });
  });

  test("explore a accept astring", () => {
    const littleA = mkStruct("a");
    littleA.fields = littleA.fields.filter((f) => f.name === "astring");
    expect("a accept astring").toMakeQuery(mkQuery(littleA));
  });

  test("explore a except astring,aninteger", () => {
    const littleA = mkStruct("a");
    littleA.fields = littleA.fields.filter(
      (f) => f.name !== "astring" && f.name !== "aninteger"
    );
    expect("a except astring,aninteger").toMakeQuery(mkQuery(littleA));
  });

  test("explore join explore", () => {
    const a = mkStruct("a");
    const b = mkStruct("b");
    b.structRelationship = { type: "foreignKey", foreignKey: "astring" };
    a.fields.push(b);
    const want = mkQuery(a);
    expect("a joins b on astring").toMakeQuery(want);
  });

  // TODO the way this test constructs the expected result is wrong and
  // reveals a broken-ness in the testing ... expecting to come back
  // here at some point when I get smarter
  test("explore a | project astring", () => {
    expect("explore a | project astring").toMakeQuery({
      ...mkQuery(mkStruct("a")),
      pipeline: [
        {
          type: "project",
          fields: ["astring"],
        },
      ],
    });
  });

  test("explore join query", () => {
    const src = `
      explore a
        joins
          string_and_count is (
            explore b | reduce astring, string_count is count()
          ) on astring
    `;
    const explore = queryForExplore(src);
    if (model.refIsStructDef(explore.structRef)) {
      const join = findField(explore.structRef, "string_and_count");
      expect(join).toBeDefined();
      if (join && join.type === "struct") {
        expect(join.fields.length).toBe(2);
        const astring = findField(join, "astring");
        const stringCount = findField(join, "string_count");
        expect(astring).toBeDefined();
        expect(stringCount).toBeDefined();
      }
    }
  });

  test("explore join rey keyed explore", () => {
    const src = `
      explore a
        joins
          string_and_count is (
            explore b primary key newstring
              newstring is CONCAT('new ', astring)
          ) on astring
    `;
    const explore = queryForExplore(src);
    if (model.refIsStructDef(explore.structRef)) {
      const join = findField(explore.structRef, "string_and_count");
      expect(join).toBeDefined();
      if (join && join.type === "struct") {
        expect(join.fields.length).toBe(aTableDef.fields.length + 1);
        expect(join.primaryKey).toBe("newstring");
      }
    }
  });

  test("explore with define", () => {
    const src = `
      export define ay is (a fields new_field is aninteger+afloat);
      explore ay | reduce astring, new_field`;
    const p = new TestTranslator(src);
    expect(p).toTranslate();
    const mr = p.translate();
    if (mr.translated) {
      const eq = mr.translated.queryList[0];
      const ay: model.Query = {
        type: "query",
        structRef: "ay",
        filterList: [],
        pipeline: [
          {
            type: "reduce",
            fields: ["astring", "new_field"],
          },
        ],
      };
      expect(eq).toEqual(ay);
    }
  });

  test("explore with filter", () => {
    const src = `define onlya is (a : [ astring: 'A' ])`;
    const onlyaStruct = {
      ...mkStruct("onlya"),
      filterList: [
        {
          expression: [{ path: "astring", type: "field" }, "='A'"],
          source: "astring:'A'",
        },
      ],
    };
    const p = new TestTranslator(src);
    expect(p).toTranslate();
    const onlya = p.nameSpace.onlya;
    expect(onlya).toEqual(onlyaStruct);
  });

  test("explore rejects measure filter", () => {
    const src = `
      define acounted is (explore a acount is count())
      define onlya is (acounted : [ acount > 0])`;
    const p = new TestTranslator(src);
    expect(p).not.toTranslate();
  });
});

describe("pipe stages", () => {
  function pipeSegment(pipeSpec: string, segmentNum = 0) {
    const e = queryForExplore(`explore a ${pipeSpec}`);
    expect(segmentNum).toBeLessThan(e.pipeline.length);
    return e.pipeline[segmentNum];
  }

  test("stage with fields", () => {
    const project = pipeSegment("| project astring,afloat,adate");
    expect(project.fields.length).toEqual(3);
  });

  test("stage filter", () => {
    const rPipeHead = pipeSegment("| reduce : [ astring: 'a' ] astring");
    const wantFilters = mkFilters("astring", "a");
    expect(rPipeHead.filterList).toEqual(wantFilters);
  });

  test("stage order and limit", () => {
    const reduce = pipeSegment(
      "| reduce astring,adate order by 2 limit 42"
    ) as model.ReduceSegment;
    expect(reduce.type).toBe("reduce");
    expect(reduce.limit).toEqual(42);
    const wantOrder: model.OrderBy[] = [{ field: 2 }];
    expect(reduce.orderBy).toEqual(wantOrder);
  });

  test("stage top n by field", () => {
    const reduce = pipeSegment(
      "| reduce top 42 by astring astring,adate limit 43"
    ) as model.ReduceSegment;
    expect(reduce.type).toBe("reduce");
    expect(reduce.limit).toEqual(42);
    expect(reduce.by).toEqual({ by: "name", name: "astring" });
  });

  test("stage top n by expression", () => {
    const reduce = pipeSegment(
      "| reduce top 42 by count() astring,adate limit 43"
    ) as model.ReduceSegment;
    expect(reduce.type).toBe("reduce");
    expect(reduce.limit).toEqual(42);
    expect(reduce.by).toEqual({
      by: "expression",
      e: [{ type: "aggregate", function: "count", e: [] }],
    });
  });

  test("stage ordered", () => {
    const reduce = pipeSegment(
      "| reduce order by astring asc, adate desc, afloat astring,adate,afloat"
    ) as model.ReduceSegment;
    expect(reduce.type).toBe("reduce");
    expect(reduce.orderBy).toEqual([
      { field: "astring", dir: "asc" },
      { field: "adate", dir: "desc" },
      { field: "afloat" },
    ]);
  });

  test("index f1,f2", () => {
    const index = pipeSegment("| index astring,afloat");
    const want: model.IndexSegment = {
      type: "index",
      fields: ["astring", "afloat"],
      filterList: [],
    };
    expect(index).toEqual(want);
  });

  test("index ... on", () => {
    const index = pipeSegment("| index on aninteger");
    const want: model.IndexSegment = {
      type: "index",
      fields: [],
      filterList: [],
      weightMeasure: "aninteger",
    };
    expect(index).toEqual(want);
  });

  test("index : [ filters ]", () => {
    const index = pipeSegment("| index : [ astring:'a' ]");
    const want: model.IndexSegment = {
      type: "index",
      fields: [],
      filterList: mkFilters("astring", "a"),
    };
    expect(index).toEqual(want);
  });

  test("index ... limit", () => {
    const index = pipeSegment("| index limit 42");
    const want: model.IndexSegment = {
      type: "index",
      fields: [],
      filterList: [],
      limit: 42,
    };
    expect(index).toEqual(want);
  });

  test("field refs generated for solo fields", () => {
    const reduce = pipeSegment("| reduce astring");
    expect(reduce.fields).toEqual(["astring"]);
  });

  test("reduce field as pipe stage", () => {
    const explore = queryForExplore(
      `explore a fields by_string_val is (reduce astring, valcount is count(*)) | by_string_val`
    );
    if (explore) {
      expect(explore.pipeHead).toEqual({ name: "by_string_val" });
    }
  });

  test("second stage has correct inputs", () => {
    const explore = queryForExplore(
      `explore a | reduce valmore is aninteger + 1, valcount is count(*) | project valmore, valcount`
    );
    const project = explore.pipeline[1] as model.ProjectSegment;
    expect(project.type).toBe("project");
    expect(project.fields).toEqual(["valmore", "valcount"]);
  });

  test("output of stage can freely replace fields from input", () => {
    const bstage = pipeSegment(`joins b on astring | REDUCE b is b.adate`);
    const want: model.ReduceSegment = {
      type: "reduce",
      fields: [{ name: "b.adate", as: "b" }],
    };
    expect(bstage).toEqual(want);
  });
});

describe("pipelines", () => {
  test("two stage turtle parses without stack overflow", () => {
    const src = `
      explore a
        pipe_turtle is (reduce ac is astring, | reduce ac)`;
    queryForExplore(src);
  });

  test("second stage starts with symbols from output of first stage", () => {
    const src = `
      explore a
      | reduce aninteger
        pipe_turtle is (
          reduce
            astring
            atime is atimestamp
            anint is aninteger,
          | reduce
            atime
            total_int is anint.sum()
        )`;
    queryForExplore(src);
  });

  test("filtered turtle", () => {
    const src = `
      explore a
        aturtle is (reduce astring, as_count is count())
      | aturtle : [ afloat > 1 ]
    `;
    const ft = queryForExplore(src);
    const filters = ft?.filterList || [];
    expect(filters[0].source).toBe("afloat>1");
  });
});

describe("field definition lists", () => {
  // At the moment, anonymous expressions are not legal, wo we have some older
  // tests which we don't need to run, leaving them herein case we change
  // our minds about that.
  test.skip("generated safe anonymous name for dotted sources", async () => {
    const n =
      "bigquery-public-data.google_analytics_sample.ga_sessions_20170801";
    const parse = await exploreFor(
      `explore '${n}' hits.latencyTracking.pageLoadTime + 1`
    );
    if (parse.schema && parse.explore) {
      const s = parse.explore.structDef();
      const lastField = s.fields[s.fields.length - 1];
      expect(lastField.name).toBe("ga_sessions_20170801_anon_0");
    } else {
      fail(pretty(parse.errors));
    }
  });

  test.skip("foo.bar.sum() is named total_bar", async () => {
    const src = `
      explore a
        fields
          b.c.afloat.sum(),
        joins
          b is (explore b joins c is a on astring) on astring
    `;
    const query = queryForExplore(src);
    const s = query.structRef;
    if (model.refIsStructDef(s)) {
      for (const field of s.fields) {
        if (model.hasExpression(field)) {
          expect(field.name).toBe("total_afloat");
        }
      }
    }
  });

  test.skip("foo.bar.avg() is named avg_bar", async () => {
    const src = `
      explore a
        fields
          b.c.afloat.avg(),
        joins
          b is (explore b joins c is a on astring) on astring
    `;
    const explore = queryForExplore(src);
    const s = explore.structRef;
    if (model.refIsStructDef(s)) {
      for (const field of s.fields) {
        if (model.hasExpression(field)) {
          expect(field.name).toBe("avg_afloat");
        }
      }
    }
  });

  test.skip("foo.bar.count() is named count_bar", async () => {
    const src = `
      explore a
        fields
          b.c.count(),
        joins
          b is (explore b joins c is a on astring) on astring
    `;
    const explore = queryForExplore(src);
    const s = explore.structRef;
    if (model.refIsStructDef(s)) {
      for (const field of s.fields) {
        if (model.hasExpression(field)) {
          expect(field.name).toBe("count_c");
        }
      }
    }
  });

  test("rename an existing field", () => {
    const want = mkQuery(aTableDef);
    if (model.refIsStructDef(want.structRef)) {
      for (const f of want.structRef.fields) {
        if (f.name === "aninteger") {
          f.as = "anint";
        }
      }
      expect("explore 'aTable' anint renames aninteger").toMakeQuery(want);
    }
  });

  test("duplicate an existing field", () => {
    const want = mkQuery(aTableDef);
    if (model.refIsStructDef(want.structRef)) {
      want.structRef.fields.push({
        type: "number",
        name: "anint",
        e: [{ type: "field", path: "aninteger" }],
      });
      expect("explore 'aTable' anint is aninteger").toMakeQuery(want);
    }
  });

  test.todo("rename a turtle");
  test.todo("rename an inline or nested or join");
  test.todo("rename a filtered aliased name");
  test.todo("rename an expression");

  test("fieldname is expression", () => {
    const want = mkQuery(mkStruct("a"));
    if (model.refIsStructDef(want.structRef)) {
      want.structRef.fields.push({
        type: "number",
        name: "answer",
        e: ["42"],
        source: "42",
      });
    }
    expect("explore a answer is 42").toMakeQuery(want);
  });

  test("wildcard *", () => {
    const aJoinsBSrc = "explore a joins b on astring";
    const aJoinsBStruct = sourceStructFromExplore(aJoinsBSrc);
    const want: model.Query = {
      ...mkQuery(aJoinsBStruct),
      pipeline: [
        {
          type: "project",
          fields: ["*"],
        },
      ],
    };
    expect(`${aJoinsBSrc}| project *`).toMakeQuery(want);
  });

  test("wildcard join.**", () => {
    const aJoinsBSrc = "explore a joins b on astring";
    const aJoinsBStruct = sourceStructFromExplore(aJoinsBSrc);
    const want: model.Query = {
      ...mkQuery(aJoinsBStruct),
      pipeline: [
        {
          type: "project",
          fields: ["b.**"],
        },
      ],
    };
    expect(`${aJoinsBSrc}| project b.**`).toMakeQuery(want);
  });

  test("wildcard join.*", () => {
    const aJoinsBSrc = "explore a joins b on astring";
    const aJoinsBStruct = sourceStructFromExplore(aJoinsBSrc);
    const want: model.Query = {
      ...mkQuery(aJoinsBStruct),
      pipeline: [
        {
          type: "project",
          fields: ["b.*"],
        },
      ],
    };
    expect(`${aJoinsBSrc}| project b.*`).toMakeQuery(want);
  });

  test("turtle field", () => {
    const want = mkQuery(mkStruct("b"));
    if (model.refIsStructDef(want.structRef)) {
      want.structRef.fields.push({
        type: "turtle",
        name: "by_string_val",
        pipeline: [
          {
            type: "reduce",
            fields: ["astring", mkCountDef("valcount", "count(*)")],
          },
        ],
      });
    }
    expect(
      "explore b fields by_string_val is (reduce astring, valcount is count(*))"
    ).toMakeQuery(want);
  });

  test("newfield is agg field", () => {
    const want = mkQuery(mkStruct("b"));
    if (model.refIsStructDef(want.structRef)) {
      want.structRef.fields.push(mkCountDef("bcount", "count()"));
    }
    want.pipeline = [
      {
        type: "reduce",
        fields: [
          {
            name: "bcount",
            as: "numb",
          },
        ],
      },
    ];
    expect(
      "explore b fields bcount is count() | reduce numb is bcount"
    ).toMakeQuery(want);
  });

  test("filtered stage field", () => {
    const src = `
      explore a
        counted_strings is (reduce astring, string_count is count())
        | reduce begina is counted_strings : [ astring:'a%']
    `;
    const want = mkQuery(mkStruct("a"));
    if (model.refIsStructDef(want.structRef)) {
      want.structRef.fields.push({
        name: "counted_strings",
        type: "turtle",
        pipeline: [
          {
            type: "reduce",
            fields: [
              "astring",
              {
                name: "string_count",
                type: "number",
                aggregate: true,
                e: [{ type: "aggregate", function: "count", e: [] }],
                source: "count()",
              },
            ],
          },
        ],
      });
    }
    want.pipeline = [
      {
        type: "reduce",
        fields: [
          {
            name: "counted_strings",
            as: "begina",
            filterList: mkFilters("astring", "a%"),
          },
        ],
      },
    ];
    expect(src).toMakeQuery(want);
  });
});

describe("expressions", () => {
  test.todo("test field takes type of columnit comes from");
  test.todo("test aggregates functions return aggregate type");
  test.todo("NULL");

  test("integer", () => {
    expect(fieldDefFromExpression("42")).toEqual({
      name: "test",
      type: "number",
      e: ["42"],
    });
  });
  test("negative float", () => {
    expect(fieldDefFromExpression("-42.0")).toEqual({
      name: "test",
      type: "number",
      e: ["-42.0"],
    });
  });
  test("scientific notation", () => {
    expect(fieldDefFromExpression("-.42e+42")).toEqual({
      name: "test",
      type: "number",
      e: ["-.42e+42"],
    });
  });
  test("true", () => {
    expect(fieldDefFromExpression("true")).toEqual({
      name: "test",
      type: "boolean",
      e: ["true"],
    });
  });

  test("false", () => {
    expect(fieldDefFromExpression("false")).toEqual({
      name: "test",
      type: "boolean",
      e: ["false"],
    });
  });

  test("string", () => {
    expect(fieldDefFromExpression("'42'")).toEqual({
      name: "test",
      type: "string",
      e: ["'42'"],
    });
  });

  test("(expr)", () => {
    expect(fieldDefFromExpression("(42)")).toEqual({
      name: "test",
      type: "number",
      e: ["(42)"],
    });
  });

  test("binary arithmetic", () => {
    expect(fieldDefFromExpression("40 + 2")).toEqual({
      name: "test",
      type: "number",
      e: ["40+2"],
    });
  });

  test("number equality", () => {
    expect(fieldDefFromExpression("42 = 6*9")).toEqual({
      name: "test",
      type: "boolean",
      e: ["42=(6*9)"],
    });
  });

  test("number inequality", () => {
    expect(fieldDefFromExpression("42 != 6*9")).toEqual({
      name: "test",
      type: "boolean",
      e: ["IFNULL(NOT(42=(6*9)),FALSE)"],
    });
  });

  test("string equality", () => {
    expect(fieldDefFromExpression("'forty_two' = '42'")).toEqual({
      name: "test",
      type: "boolean",
      e: ["'forty_two'='42'"],
    });
  });

  test("string inequality", () => {
    expect(fieldDefFromExpression("'forty_two' != '42'")).toEqual({
      name: "test",
      type: "boolean",
      e: ["IFNULL(NOT('forty_two'='42'),FALSE)"],
    });
  });

  test("binary boolean", () => {
    expect(fieldDefFromExpression("true and true")).toEqual({
      name: "test",
      type: "boolean",
      e: ["true and true"],
    });
  });

  test("count(*)", () => {
    expect(fieldDefFromExpression("count(*)")).toEqual(mkCountDef("test"));
  });

  test("count()", () => {
    expect(fieldDefFromExpression("count()")).toEqual(mkCountDef("test"));
  });

  test("count(distinct x)", () => {
    expect(fieldDefFromExpression("count(distinct astring)")).toEqual(
      mkAgg("count_distinct", "test", [mkFieldFrag("astring")])
    );
  });

  test("sum(x)", () => {
    expect(fieldDefFromExpression("sum(aninteger)")).toEqual(
      mkAgg("sum", "test", [mkFieldFrag("aninteger")])
    );
  });

  test("foo.sum(x)", () => {
    expect(fieldDefFromExpression("foo.sum(aninteger)")).toEqual({
      name: "test",
      type: "number",
      aggregate: true,
      e: [
        {
          type: "aggregate",
          function: "sum",
          structPath: "foo",
          e: [mkFieldFrag("aninteger")],
        },
      ],
    });
  });

  test("foo.sum()", () => {
    const src = `
      explore a
        bsum is b.aninteger.sum()
        joins b on astring`;
    const a = mkStruct("a");
    const b = mkStruct("b");
    b.structRelationship = { type: "foreignKey", foreignKey: "astring" };
    a.fields.push(b);
    a.fields.push({
      aggregate: true,
      e: [
        {
          e: [{ path: "b.aninteger", type: "field" }],
          structPath: "b",
          type: "aggregate",
          function: "sum",
        },
      ],
      name: "bsum",
      type: "number",
      source: "b.aninteger.sum()",
    });
    const want = mkQuery(a);
    expect(src).toMakeQuery(want);
  });

  test("max(num)", () => {
    expect(fieldDefFromExpression("max(aninteger)")).toEqual(
      mkAgg("max", "test", [mkFieldFrag("aninteger")])
    );
  });

  test("min(date)", () => {
    expect(fieldDefFromExpression("max(adate)")).toEqual(
      mkAgg("max", "test", [mkFieldFrag("adate")], "date")
    );
  });

  test("max(string)", () => {
    expect(fieldDefFromExpression("max(astring)")).toEqual(
      mkAgg("max", "test", [mkFieldFrag("astring")], "string")
    );
  });

  test("max(timestamp)", () => {
    expect(fieldDefFromExpression("max(atimestamp)")).toEqual(
      mkAgg("max", "test", [mkFieldFrag("atimestamp")], "timestamp")
    );
  });

  test("filtered count", () => {
    expect(fieldDefFromExpression("count() : [ astring: 'a%' ]")).toEqual({
      name: "test",
      type: "number",
      aggregate: true,
      e: [
        {
          type: "filterExpression",
          filterList: mkFilters("astring", "a%"),
          e: [
            {
              function: "count",
              type: "aggregate",
              e: [],
            },
          ],
        },
      ],
    });
  });

  test("filtered min", () => {
    expect(fieldDefFromExpression("min(afloat) : [ astring: 'a%' ]")).toEqual({
      name: "test",
      type: "number",
      aggregate: true,
      e: [
        {
          type: "filterExpression",
          filterList: mkFilters("astring", "a%"),
          e: [
            {
              function: "min",
              type: "aggregate",
              e: [{ type: "field", path: "afloat" }],
            },
          ],
        },
      ],
    });
  });

  test("cast to string", () => {
    expect(fieldDefFromExpression("cast(42 as string)")).toEqual({
      name: "test",
      type: "string",
      e: ["cast(42 as string)"],
    });
  });

  test("cast to number", () => {
    expect(fieldDefFromExpression("cast(42 as number)")).toEqual({
      name: "test",
      type: "number",
      e: ["cast(42 as float64)"],
    });
  });

  test("cast to boolean", () => {
    expect(fieldDefFromExpression("cast(42 as boolean)")).toEqual({
      name: "test",
      type: "boolean",
      e: ["cast(42 as boolean)"],
    });
  });

  test("cast to date", () => {
    expect(fieldDefFromExpression("cast(42 as date)")).toEqual({
      name: "test",
      type: "date",
      e: ["cast(42 as date)"],
    });
  });

  test("cast to timestamp", () => {
    expect(fieldDefFromExpression("cast(42 as timestamp)")).toEqual({
      name: "test",
      type: "timestamp",
      e: ["cast(42 as timestamp)"],
    });
  });

  test("agg(x) OP agg(y)", () => {
    expect(
      fieldDefFromExpression("(count() : [astring: 'ca']) / count()")
    ).toEqual({
      name: "test",
      type: "number",
      aggregate: true,
      e: [
        "((",
        {
          type: "filterExpression",
          filterList: mkFilters("astring", "ca"),
          e: [{ type: "aggregate", function: "count", e: [] }],
        },
        "))/",
        { type: "aggregate", function: "count", e: [] },
      ],
    });
  });

  test.todo("bare join.aggfunx(expre)");
  test.todo("bigquery functions ... need function type map");

  test("case", () => {
    expect(
      fieldDefFromExpression("case when true then 'true' else 'false' end")
    ).toEqual({
      name: "test",
      type: "string",
      e: ["CASE WHEN true THEN 'true' ELSE 'false' END"],
    });
  });

  test("pick", () => {
    expect(
      fieldDefFromExpression("pick 'true' when true else 'false'")
    ).toEqual({
      name: "test",
      type: "string",
      e: ["CASE WHEN true THEN 'true' ELSE 'false' END"],
    });
  });

  test("pick no value", () => {
    expect(fieldDefFromExpression("'a': pick when 'a' ELSE 'nota'")).toEqual({
      name: "test",
      type: "string",
      e: ["CASE WHEN 'a'='a' THEN 'a' ELSE 'nota' END"],
    });
  });

  test("pick value or null", () => {
    expect(fieldDefFromExpression("'a': pick when 'a' ELSE null")).toEqual({
      name: "test",
      type: "string",
      e: ["CASE WHEN 'a'='a' THEN 'a' ELSE NULL END"],
    });
  });

  test("apply pick no no else", () => {
    expect(
      fieldDefFromExpression("'correct': pick 'incorrect' when false")
    ).toEqual({
      name: "test",
      type: "string",
      e: ["CASE WHEN 'correct'=false THEN 'incorrect' ELSE 'correct' END"],
    });
  });

  test("apply pick with alternatives", () => {
    expect(
      fieldDefFromExpression("'check': pick 'correct' when 'good' | 'ok'")
    ).toEqual({
      name: "test",
      type: "string",
      e: [
        "CASE WHEN ('check'='good')or('check'='ok') THEN 'correct' ELSE 'check' END",
      ],
    });
  });

  test("apply pick with partial", () => {
    expect(
      fieldDefFromExpression(
        "45: pick 'senior' when >= 65 pick 'adult' when >=18 else 'minor'"
      )
    ).toEqual({
      name: "test",
      type: "string",
      e: [
        "CASE WHEN 45>=65 THEN 'senior' WHEN 45>=18 THEN 'adult' ELSE 'minor' END",
      ],
    });
  });

  test.todo("abitrary filters");

  test("string match string", () => {
    expect(fieldDefFromExpression("astring ~ 'CA%'")).toEqual({
      name: "test",
      type: "boolean",
      e: [{ type: "field", path: "astring" }, " LIKE 'CA%'"],
    });
  });

  test("string !match string", () => {
    expect(fieldDefFromExpression("astring !~ 'CA%'")).toEqual({
      name: "test",
      type: "boolean",
      e: [
        "IFNULL(NOT(",
        { type: "field", path: "astring" },
        " LIKE 'CA%'),FALSE)",
      ],
    });
  });

  test("string match regex", () => {
    expect(fieldDefFromExpression("astring ~ /'CA|NY'")).toEqual({
      name: "test",
      type: "boolean",
      e: ["REGEXP_CONTAINS(", { type: "field", path: "astring" }, ",r'CA|NY')"],
    });
  });

  test("string not match regex", () => {
    expect(fieldDefFromExpression("astring !~ /'CA|NY'")).toEqual({
      name: "test",
      type: "boolean",
      e: [
        "IFNULL(NOT(REGEXP_CONTAINS(",
        { type: "field", path: "astring" },
        ",r'CA|NY')),FALSE)",
      ],
    });
  });

  test("string = regex", () => {
    expect(fieldDefFromExpression("astring = /'CA|NY'")).toEqual({
      name: "test",
      type: "boolean",
      e: ["REGEXP_CONTAINS(", { type: "field", path: "astring" }, ",r'CA|NY')"],
    });
  });

  test("string != regex", () => {
    expect(fieldDefFromExpression("astring != /'CA|NY'")).toEqual({
      name: "test",
      type: "boolean",
      e: [
        "IFNULL(NOT(REGEXP_CONTAINS(",
        { type: "field", path: "astring" },
        ",r'CA|NY')),FALSE)",
      ],
    });
  });

  test("regex = string", () => {
    expect(fieldDefFromExpression("/'CA|NY' = astring")).toEqual({
      name: "test",
      type: "boolean",
      e: ["REGEXP_CONTAINS(", { type: "field", path: "astring" }, ",r'CA|NY')"],
    });
  });

  test("regex != string", () => {
    expect(fieldDefFromExpression("r'CA|NY' != astring")).toEqual({
      name: "test",
      type: "boolean",
      e: [
        "IFNULL(NOT(REGEXP_CONTAINS(",
        { type: "field", path: "astring" },
        ",r'CA|NY')),FALSE)",
      ],
    });
  });

  test("colon regex", () => {
    expect(fieldDefFromExpression("astring:/'CA|NY'")).toEqual({
      name: "test",
      type: "boolean",
      e: ["REGEXP_CONTAINS(", { type: "field", path: "astring" }, ",r'CA|NY')"],
    });
  });

  test("regex colon", () => {
    expect(fieldDefFromExpression("/'CA|NY':astring")).toEqual({
      name: "test",
      type: "boolean",
      e: ["REGEXP_CONTAINS(", { type: "field", path: "astring" }, ",r'CA|NY')"],
    });
  });

  test("compare not equal NULL", () => {
    expect(fieldDefFromExpression("'a' != NULL")).toEqual({
      name: "test",
      type: "boolean",
      e: ["'a' IS NOT NULL"],
    });
  });

  test("compare equal NULL", () => {
    expect(fieldDefFromExpression("'a' = NULL")).toEqual({
      name: "test",
      type: "boolean",
      e: ["'a' IS NULL"],
    });
  });

  test("compare NULL equal NULL", () => {
    expect(fieldDefFromExpression("NULL = NULL")).toEqual({
      name: "test",
      type: "boolean",
      e: ["true"],
    });
  });

  test("compare NULL not equal NULL", () => {
    expect(fieldDefFromExpression("NULL != NULL")).toEqual({
      name: "test",
      type: "boolean",
      e: ["false"],
    });
  });

  test("number in range", () => {
    expect(fieldDefFromExpression("42 = 1 to 100")).toEqual({
      name: "test",
      type: "boolean",
      e: ["(42>=1)and(42<100)"],
    });
  });

  test("number outside range", () => {
    expect(fieldDefFromExpression("42 != 1 to 100")).toEqual({
      name: "test",
      type: "boolean",
      e: ["(42<1)or(42>=100)"],
    });
  });

  test("timestamp for range", () => {
    expect(fieldDefFromExpression("now:now for 5 seconds")).toEqual({
      name: "test",
      type: "boolean",
      e: [
        "(CURRENT_TIMESTAMP()>=CURRENT_TIMESTAMP())and(CURRENT_TIMESTAMP()<TIMESTAMP_ADD(CURRENT_TIMESTAMP(),INTERVAL 5 SECOND))",
      ],
    });
  });

  test("dimension source code passed to back end", () => {
    const expr = "e is afloat + 42 / 54";
    const exprParse = new TestTranslator(expr, "fieldDef");
    const exprAst = exprParse.ast();
    expect(exprAst).toBeInstanceOf(ast.ExpressionFieldDef);
    if (exprAst instanceof ast.ExpressionFieldDef) {
      const f = exprAst.fieldDef(new FieldSpace(aTableDef), "test");
      expect(exprParse).toBeErrorless();
      expect(f.source).toEqual("afloat+42/54");
    } else {
      fail(`${expr} did not translate into a fielddef`);
    }
  });
});

describe("expression extensions", () => {
  function expr(expr: string) {
    return fieldDefFromExpression(expr).e;
  }

  test("unary not and null", () => {
    expect(expr("not 1>2")).toEqual(["IFNULL(NOT(1>2),FALSE)"]);
  });

  test("colon with partial", () => {
    expect(expr("'a': > 'A'")).toEqual(["'a'>'A'"]);
  });

  test("colon two different partials", () => {
    expect(expr("'b': > 'a' & < 'c'")).toEqual(["('b'>'a')and('b'<'c')"]);
  });

  test("colon compare plus partial", () => {
    expect(expr("'state': /'CA|NY|FL' & != 'CA'")).toEqual([
      "(REGEXP_CONTAINS('state',r'CA|NY|FL'))and(IFNULL(NOT('state'='CA'),FALSE))",
    ]);
  });

  test("colon with value", () => {
    expect(expr("'a': 'A'")).toEqual(["'a'='A'"]);
  });

  test("compare with conjuction", () => {
    expect(expr("'a' = 'b' | 'c'")).toEqual(["('a'='b')or('a'='c')"]);
  });

  test("compare plus partial", () => {
    expect(expr("'a' > 'b' & != 'c')")).toEqual([
      "('a'>'b')and(IFNULL(NOT('a'='c'),FALSE))",
    ]);
  });

  test("compare plus composed partial", () => {
    expect(expr("'a' != 'b' & (>'X' & <'Z')")).toEqual([
      "(IFNULL(NOT('a'='b'),FALSE))and(('a'>'X')and('a'<'Z'))",
    ]);
  });

  test("compare with three alternatives", () => {
    expect(expr("'a' = 'b' | 'c' | 'd'")).toEqual([
      "('a'='b')or(('a'='c')or('a'='d'))",
    ]);
  });

  test("compare with left alternation", () => {
    expect(expr("'a' = ('b'|'c')")).toEqual(["('a'='b')or('a'='c')"]);
  });

  test("compare with complex alternation", () => {
    expect(expr("'a' = (('b'|'c')|'d')")).toEqual([
      "(('a'='b')or('a'='c'))or('a'='d')",
    ]);
  });

  test("partial compare can compose with value", () => {
    expect(expr("'a': (='b' | 'c')")).toEqual(["('a'='b')or('a'='c')"]);
  });

  test("partial compare can compose tree with value", () => {
    expect(expr("'m': ((>'a' & <'z') | 'c')")).toEqual([
      "(('m'>'a')and('m'<'z'))or('m'='c')",
    ]);
  });

  test("comapre with and alternative", () => {
    expect(expr("'a'!='b'&'c'&'d'")).toEqual([
      "(IFNULL(NOT('a'='b'),FALSE))and((IFNULL(NOT('a'='c'),FALSE))and(IFNULL(NOT('a'='d'),FALSE)))",
    ]);
  });
});

describe("document", () => {
  test("name as in explore does not blow up stack", () => {
    const modelSrc = `
      explore 'aTable'
        bar is afloat
        baz is bar+1
      | reduce baz`;
    queryForExplore(modelSrc);
  });

  test("name is remembered", async () => {
    const modelSrc = `export define newa is (explore 'aTable' primary key astring)`;
    const p = new TestTranslator(modelSrc);
    const model = p.nameSpace;
    expect(model).toHaveProperty("newa");
    expect(model.newa.as).toBe("newa");
  });

  test("x model", async () => {
    const letsgoSrc = `
      define aircraft_models is
        (explore 'lookerdata.liquor.aircraft_models'
          primary key aircraft_model_code
          total_seats is sum(seats),
          airport_count is count(*),
        );

      export define aircraft is
        (explore 'lookerdata.liquor.aircraft'
          primary key tail_num
          aircraft_count is count(*),
          joins
            aircraft_models on aircraft_model_code
        );
        `;
    const letsParse = new TestTranslator(letsgoSrc);
    const needThese: NeedSchemaData = {
      tables: [
        "lookerdata.liquor.aircraft_models",
        "lookerdata.liquor.aircraft",
      ],
    };
    expect(letsParse).toBeValidMalloy();
    const xr = letsParse.translate();
    expect(xr).toEqual(needThese);
    const tables = await Malloy.db.getSchemaForMissingTables(needThese.tables);
    letsParse.update({ tables });
    expect(letsParse).toTranslate();
  });

  test("primary key not lost in model", async () => {
    const modelSrc = `export define a_i_made is (explore 'aTable' primary key astring)`;
    const p = new TestTranslator(modelSrc);
    expect(p).toTranslate();
    expect(p.nameSpace).toHaveProperty("a_i_made");
    expect(p.nameSpace.a_i_made.primaryKey).toBe("astring");
  });

  test("define three explores", () => {
    const threeExploreSource = `
      export define newA is (a);
      define newB is (b);
      export define newBB is (newB);
    `;
    const docParse = new TestTranslator(threeExploreSource);
    expect(docParse).toTranslate();
    expect(docParse.nameSpace).toHaveProperty("newA");
    expect(docParse.nameSpace).toHaveProperty("newB");
    expect(docParse.nameSpace).toHaveProperty("newBB");
    const visible = docParse.translate().translated?.modelDef.exports;
    expect(visible).toBeDefined();
    expect(visible).toContain("newA");
    expect(visible).not.toContain("newB");
    expect(visible).toContain("newBB");
  });

  test("succesful import", () => {
    const parentSrc = `
      import "child";
      export define parent is (explore childA new1 is new0 + 1);
    `;
    const parentDoc = new TestTranslator(parentSrc);
    parentDoc.update({
      URLs: {
        "internal://test/child":
          "export define childA is ('aTable' new0 is aninteger + 1)",
      },
    });
    expect(parentDoc).toTranslate();
    const parent = parentDoc.nameSpace.parent;
    expect(parent).toBeDefined();
    expect(parent.type === "struct");
    if (parent && parent.type === "struct") {
      expect(findField(parent, "astring")).toBeDefined();
      expect(findField(parent, "new1")).toBeDefined();
      expect(findField(parent, "new0")).toBeDefined();
    }
  });

  test("missing import", () => {
    const parentSrc = `
      -- Not one line one
      import "no-such-file";
      export define parent is (explore childA new1 is new0 + 1);
    `;
    const parentDoc = new TestTranslator(parentSrc);
    parentDoc.update({
      errors: {
        URLs: { "internal://test/no-such-file": "No such file or directory" },
      },
    });
    expect(parentDoc.unresolved()).toBeNull();
    const whyNot = parentDoc.translate();
    expect(whyNot).toHaveProperty("errors");
  });

  test("chained imports", () => {
    const parentSrc = `
      import "child";
      export define parent is (explore childC newP is newC + 1);
    `;
    const parentDoc = new TestTranslator(parentSrc);
    parentDoc.update({
      URLs: {
        "internal://test/child": `
          import "grandchild"
          export define childC is (explore childG newC is newG + 1)
        `,
        "internal://test/grandchild":
          "export define childG is ('aTable' newG is aninteger + 1)",
      },
    });
    expect(parentDoc).toTranslate();
    const parent = parentDoc.nameSpace.parent;
    expect(parent).toBeDefined();
    const fields = parent.fields;
    expect(fields).toBeDefined();
    if (fields) {
      expect(fields.find((f) => f.name === "newG")).toBeTruthy();
      expect(fields.find((f) => f.name === "newC")).toBeTruthy();
      expect(fields.find((f) => f.name === "newP")).toBeTruthy();
    }
  });

  test("query lists", () => {
    const q2Doc = new TestTranslator("a;b");
    expect(q2Doc).toTranslate();
    const translation = q2Doc.translate();
    expect(translation).toHaveProperty("translated");
    if (translation.translated) {
      expect(translation.translated.queryList).toHaveLength(2);
      const [qa, qb] = translation.translated.queryList;
      expect(qa.structRef).toEqual(mkStruct("a"));
      expect(qb.structRef).toEqual(mkStruct("b"));
    }
  });

  test("missing table schema", () => {
    const noTableDoc = new TestTranslator("explore 'no.such.table'");
    const ask = noTableDoc.translate();
    expect(noTableDoc).toBeErrorless();
    expect(ask).toEqual({ tables: ["no.such.table"] });
    noTableDoc.update({ errors: { tables: { "no.such.table": "XYZZY" } } });
    noTableDoc.translate();
    const shouldBeBad = noTableDoc.prettyErrors();
    expect(shouldBeBad).toContain("XYZZY");
    expect(shouldBeBad).toContain("no.such.table");
  });
});

describe("reasonable handling of undefined references", () => {
  test("field name in expression", () => {
    expect("define ax is (explore a thex is xyzzy + 1)").toHaveExploreErrors(
      "Reference to 'xyzzy' with no definition"
    );
  });

  test.todo("named source");
  test.todo("field name in aliased name");
  test.todo("no match for wildcards");
  test.todo("join key");
  test.todo("field name in filter");
});

describe("semantic checks", () => {
  test.todo("name is name in an explore field list");
});

describe("parameters", () => {
  test("declare required condition", () => {
    const md = translatedModel("define ap has aparam : timestamp is (a)");
    const ap = md.structs.ap;
    expect(ap).toBeDefined();
    const want = mkStruct("ap");
    want.parameters = {
      aparam: {
        name: "aparam",
        type: "timestamp",
        condition: null,
      },
    };
    expect(ap).toEqual(want);
  });

  test("declare optional timestamp value", () => {
    const md = translatedModel(
      "define ap has aparam timestamp or @1960-06-30 is (a)"
    );
    const ap = md.structs.ap;
    expect(ap).toBeDefined();
    const want = mkStruct("ap");
    want.parameters = {
      aparam: {
        name: "aparam",
        type: "timestamp",
        value: ["'1960-06-30'"],
      },
    };
    expect(ap).toEqual(want);
  });

  test("declare optional string value", () => {
    const md = translatedModel(
      `define ap has aparam string or 'forty two' is (a)`
    );
    const ap = md.structs.ap;
    expect(ap).toBeDefined();
    const want = mkStruct("ap");
    want.parameters = {
      aparam: {
        name: "aparam",
        type: "string",
        value: ["'forty two'"],
      },
    };
    expect(ap).toEqual(want);
  });

  test("reference only string value parameter", () => {
    const md = translatedModel(
      `define ap has aparam string or 'forty two' is (a
        afield is aparam)
      `
    );
    const ap = md.structs.ap;
    expect(ap).toBeDefined();
    if (ap.type === "struct") {
      const afield = findField(ap, "afield");
      expect(afield).toEqual({
        type: "string",
        name: "afield",
        e: [{ type: "parameter", path: "aparam" }],
        aggregate: false,
      });
    }
  });

  test("reference number value parameter in expression", () => {
    const md = translatedModel(
      `define ap has aparam number or 41 is (a
        afield is aparam + 1)
      `
    );
    const ap = md.structs.ap;
    expect(ap).toBeDefined();
    if (ap.type === "struct") {
      const afield = findField(ap, "afield");
      expect(afield).toEqual({
        name: "afield",
        type: "number",
        e: [{ type: "parameter", path: "aparam" }, "+1"],
        source: "aparam+1",
      });
    }
  });
});
