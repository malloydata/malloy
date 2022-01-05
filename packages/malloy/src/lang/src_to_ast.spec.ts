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
import { readFileSync, readdirSync } from "fs";
import {
  aExpr,
  mkExprIdRef,
  mkFieldName,
  caFilter,
  mkExploreOf,
  mkFieldRefs,
  aTableDef,
  TestTranslator,
} from "./jest-factories";
import * as ast from "./ast";
import { MalloyTranslator } from "./parse-malloy";
import { UpdateData } from ".";

describe("translation api", () => {
  test("format an explore, looks correct", () => {
    const ep = new TestTranslator(
      "explore a primary key astring c is count(*) | reduce newName is afloat + 1",
      "explore"
    );
    const epAST = ep.ast();
    expect(epAST?.toString()).toBe(
      `<explore>
  source: <namedSource> name=a
  primaryKey: <primary key>
    field: <field name> name=astring
  fields: [
    <expressionField> exprSrc=count(*)
      expr: <count> func=count
      fieldName: <field name> name=c
  ]
  pipeline: <pipeline>
    pipeBody: [
      <reduce>
        fields: [
          <expressionField> exprSrc=afloat+1
            expr: <+-> op=+
              left: <id reference> refString=afloat
              right: <numeric literal> n=1
            fieldName: <field name> name=newName
        ]
        orderBy: []
    ]`
    );
  });

  test("table reference generates SchemaRequest", () => {
    const x = new TestTranslator("explore 'table.name'", "explore");
    const mustNeedTables = x.translate();
    expect(mustNeedTables).toHaveProperty("tables");
  });

  test("schema data satisfies SchemaRequest", () => {
    const x = new TestTranslator("explore 'table.name'", "explore");
    const mustNeedTables = x.translate();
    expect(mustNeedTables).toHaveProperty("tables");
    x.update({ tables: { "table.name": aTableDef } });
    const mustNeedNothing = x.translate();
    expect(mustNeedNothing).toHaveProperty("translated");
  });
});

describe("expressions", () => {
  const aTrue = new ast.Boolean("true");
  const aFalse = new ast.Boolean("false");
  const n42 = new ast.ExprNumber("42");
  const n4p2 = new ast.ExprNumber("4.2");
  const sString = new ast.ExprString("'malloy is for dummies'");
  const aNULL = new ast.ExprNULL();

  test("literal true", () => {
    expect("true").toMakeAST("fieldExpr", aTrue);
  });

  test("literal false", () => {
    expect("false").toMakeAST("fieldExpr", aFalse);
  });
  test("not", () => {
    expect("not false").toMakeAST("fieldExpr", new ast.ExprNot(aFalse));
  });
  test("and", () => {
    expect("true and false").toMakeAST(
      "fieldExpr",
      new ast.ExprLogicalOp(aTrue, "and", aFalse)
    );
  });
  test("or", () => {
    expect("true or false").toMakeAST(
      "fieldExpr",
      new ast.ExprLogicalOp(aTrue, "or", aFalse)
    );
  });

  test("string literal", () => {
    expect("'malloy is for dummies'").toMakeAST("fieldExpr", sString);
  });

  test("integer literal", () => {
    expect("42").toMakeAST("fieldExpr", n42);
  });
  test("float literal", () => {
    expect("4.2").toMakeAST("fieldExpr", n4p2);
  });
  test("field name", () => {
    expect("a").toMakeAST("fieldExpr", aExpr);
  });
  test("NULL", () => {
    expect("NULL").toMakeAST("fieldExpr", aNULL);
  });
  test("( 42 )", () => {
    expect("(42)").toMakeAST("fieldExpr", new ast.ExprParens(n42));
  });
  test("-42", () => {
    expect("-42").toMakeAST("fieldExpr", new ast.ExprMinus(n42));
  });
  test("42 - 4.2", () => {
    expect("42 - 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprAddSub(n42, "-", n4p2)
    );
  });
  test("42 + 4.2", () => {
    expect("42 + 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprAddSub(n42, "+", n4p2)
    );
  });
  test("42 * 4.2", () => {
    expect("42 * 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprMulDiv(n42, "*", n4p2)
    );
  });
  test("42 / 4.2", () => {
    expect("42 / 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprMulDiv(n42, "/", n4p2)
    );
  });
  test("42 > 4.2", () => {
    expect("42 > 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprCompare(n42, ">", n4p2)
    );
  });
  test("42 = 4.2", () => {
    expect("42 = 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprCompare(n42, "=", n4p2)
    );
  });
  test("42 < 4.2", () => {
    expect("42 < 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprCompare(n42, "<", n4p2)
    );
  });
  test("42 >= 4.2", () => {
    expect("42 >= 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprCompare(n42, ">=", n4p2)
    );
  });
  test("42 <= 4.2", () => {
    expect("42 <= 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprCompare(n42, "<=", n4p2)
    );
  });
  test("42 != 4.2", () => {
    expect("42 != 4.2").toMakeAST(
      "fieldExpr",
      new ast.ExprCompare(n42, "!=", n4p2)
    );
  });

  test("count()", () => {
    expect("count()").toMakeAST("fieldExpr", new ast.ExprCount());
  });
  test("count(distinct a)", () => {
    expect("count(distinct a)").toMakeAST(
      "fieldExpr",
      new ast.ExprCountDistinct(aExpr)
    );
  });
  test("sum(a)", () => {
    expect("sum(a)").toMakeAST("fieldExpr", new ast.ExprSum(aExpr));
  });
  test("avg(a)", () => {
    expect("avg(a)").toMakeAST("fieldExpr", new ast.ExprAvg(aExpr));
  });
  test("min(a)", () => {
    expect("min(a)").toMakeAST("fieldExpr", new ast.ExprMin(aExpr));
  });
  test("max(a)", () => {
    expect("max(a)").toMakeAST("fieldExpr", new ast.ExprMax(aExpr));
  });
  test("a.sum(b)", () => {
    const func = new ast.ExprSum(mkExprIdRef("b"), "a");
    expect("a.sum(b)").toMakeAST("fieldExpr", func);
  });
  test("function call", () => {
    expect("withargs(42, 'malloy is for dummies')").toMakeAST(
      "fieldExpr",
      new ast.ExprFunc("withargs", [n42, sString])
    );
  });
  test("function()", () => {
    expect("noargs()").toMakeAST("fieldExpr", new ast.ExprFunc("noargs", []));
  });

  test("case when 42 then 4.2 else NULL end", () => {
    expect("case when 42 then 4.2 else NULL end").toMakeAST(
      "fieldExpr",
      new ast.ExprCase([new ast.WhenClause(n42, n4p2)], aNULL)
    );
  });

  test("case when 42 then 4.2", () => {
    expect("case when 42 then 4.2 end").toMakeAST(
      "fieldExpr",
      new ast.ExprCase([new ast.WhenClause(n42, n4p2)])
    );
  });

  test("full pick", () => {
    expect("pick 'a' when 'A' pick 'B' when 'b' else 'c'").toMakeAST(
      "fieldExpr",
      new ast.Pick(
        [
          new ast.PickWhen(
            new ast.ExprString(`'a'`),
            new ast.ExprString(`'A'`)
          ),
          new ast.PickWhen(
            new ast.ExprString(`'B'`),
            new ast.ExprString(`'b'`)
          ),
        ],
        new ast.ExprString(`'c'`)
      )
    );
  });

  test("pick no value", () => {
    expect("'a': pick when 'a' ELSE 'nota'").toMakeAST(
      "fieldExpr",
      new ast.Apply(
        new ast.ExprString(`'a'`),
        new ast.Pick(
          [new ast.PickWhen(undefined, new ast.ExprString(`'a'`))],
          new ast.ExprString("'nota'")
        )
      )
    );
  });

  test("pick no else", () => {
    expect("pick 'a' when 'A' pick 'B' when 'b'").toMakeAST(
      "fieldExpr",
      new ast.Pick([
        new ast.PickWhen(new ast.ExprString(`'a'`), new ast.ExprString(`'A'`)),
        new ast.PickWhen(new ast.ExprString(`'B'`), new ast.ExprString(`'b'`)),
      ])
    );
  });

  test("some_count : [ state:'ca']", () => {
    expect("some_count : [ state:'ca']").toMakeAST(
      "fieldExpr",
      new ast.ExprFilter(mkExprIdRef("some_count"), caFilter)
    );
  });

  test("cast to string", () => {
    expect("cast(42 as string)").toMakeAST(
      "fieldExpr",
      new ast.ExprCast(n42, "string")
    );
  });

  test("cast to boolean", () => {
    expect("cast(42 as boolean)").toMakeAST(
      "fieldExpr",
      new ast.ExprCast(n42, "boolean")
    );
  });

  test("cast to number", () => {
    expect("cast(42 as number)").toMakeAST(
      "fieldExpr",
      new ast.ExprCast(n42, "number")
    );
  });
  test("cast to date", () => {
    expect("cast(42 as date)").toMakeAST(
      "fieldExpr",
      new ast.ExprCast(n42, "date")
    );
  });

  test("cast to timestamp", () => {
    expect("cast(42 as timestamp)").toMakeAST(
      "fieldExpr",
      new ast.ExprCast(n42, "timestamp")
    );
  });

  test("safecast timestamp", () => {
    expect("42::timestamp)").toMakeAST(
      "fieldExpr",
      new ast.ExprCast(n42, "timestamp", true)
    );
  });

  test("month truncation", () => {
    expect("now.month").toMakeAST(
      "fieldExpr",
      new ast.ExprGranularTime(new ast.ExprNow(), "month", true)
    );
  });

  test("colon with partial", () => {
    expect("42:>4.2").toMakeAST(
      "fieldExpr",
      new ast.Apply(n42, new ast.PartialCompare(">", n4p2))
    );
  });

  test("compare plus conjunction", () => {
    expect("42 >= 4.2|42").toMakeAST(
      "fieldExpr",
      new ast.ExprCompare(
        n42,
        ">=",
        new ast.ExprAlternationTree(n4p2, "|", n42)
      )
    );
  });

  test("compare plus partial", () => {
    expect("42 > 4.2 & =42").toMakeAST(
      "fieldExpr",
      new ast.ExprCompare(
        n42,
        ">",
        new ast.ExprAlternationTree(n4p2, "&", new ast.PartialCompare("=", n42))
      )
    );
  });
  test("numeric range", () => {
    expect("4.2 to 42").toMakeAST("fieldExpr", new ast.Range(n4p2, n42));
  });

  test("date for range", () => {
    expect("now for 42 days").toMakeAST(
      "fieldExpr",
      new ast.ForRange(new ast.ExprNow(), n42, new ast.Timeframe("day"))
    );
  });
});

describe("field definitions", () => {
  test("newName rename oldName", () => {
    expect("newA renames a").toMakeAST(
      "fieldDef",
      new ast.RenameField("newA", "a")
    );
  });

  test("rename reserved word in external table", async () => {
    const countyData = "bigquery-public-data.covid19_nyt.us_counties";
    const src = `
      explore '${countyData}'
      fields
        foo renames \`date\`
    `;
    const tables = {
      "bigquery-public-data.covid19_nyt.us_counties": {
        type: "struct",
        name: "bigquery-public-data.covid19_nyt.us_counties",
        dialect: "standardsql",
        structSource: {
          type: "table",
        },
        structRelationship: {
          type: "basetable",
        },
        fields: [
          {
            name: "date",
            type: "date",
          },
          {
            name: "county",
            type: "string",
          },
          {
            name: "state_name",
            type: "string",
          },
          {
            name: "county_fips_code",
            type: "string",
          },
          {
            name: "confirmed_cases",
            type: "number",
            numberType: "integer",
          },
          {
            name: "deaths",
            type: "number",
            numberType: "integer",
          },
        ],
      },
    };
    const trans = new TestTranslator(src, "explore");
    trans.update({ tables } as Partial<UpdateData>);
    expect(trans).toBeValidMalloy();
  });

  test("fieldName", () => {
    expect("a").toMakeAST("fieldDef", mkFieldRefs("a"));
  });

  test("exploreName.fieldName", () => {
    expect("a.b").toMakeAST("fieldDef", mkFieldRefs("a.b"));
  });

  test("wildcard", () => {
    expect("*").toMakeAST(
      "fieldDef",
      new ast.FieldReferences([new ast.Wildcard("", "*")])
    );
  });

  test("wildcard double star", () => {
    expect("**").toMakeAST(
      "fieldDef",
      new ast.FieldReferences([new ast.Wildcard("", "**")])
    );
  });

  test("wildcard dot star", () => {
    expect("joinName.*").toMakeAST(
      "fieldDef",
      new ast.FieldReferences([new ast.Wildcard("joinName", "*")])
    );
  });

  test("field name with quoted keywords", () => {
    expect("`explore`.`join`").toMakeAST(
      "fieldDef",
      mkFieldRefs("explore.join")
    );
  });

  test("name is field_expression", () => {
    const eAnswer = new ast.ExprMulDiv(
      new ast.ExprNumber("6"),
      "*",
      new ast.ExprNumber("9")
    );
    expect("answer is 6*9").toMakeAST(
      "fieldDef",
      new ast.ExpressionFieldDef(eAnswer, mkFieldName("answer"), "6*9")
    );
  });

  const aReduce = new ast.PipelineElement([
    new ast.Reduce({ fields: [mkFieldRefs("a")] }),
  ]);

  test("stage field", () => {
    expect("justa is (reduce a)").toMakeAST(
      "fieldDef",
      new ast.Turtle(aReduce, mkFieldName("justa"))
    );
  });
  test("name staged field", () => {
    expect("aReduce is (reduce a)").toMakeAST(
      "fieldDef",
      new ast.Turtle(aReduce, new ast.FieldName("aReduce"))
    );
  });
});

describe("pipe stages", () => {
  test("fields", () => {
    expect("reduce a,b").toMakeAST(
      "queryStage",
      new ast.Reduce({
        fields: [mkFieldRefs("a", "b")],
      })
    );
  });

  test("filters", () => {
    expect("reduce : [state:'ca'] x").toMakeAST(
      "queryStage",
      new ast.Reduce({
        fields: [mkFieldRefs("x")],
        filter: caFilter,
      })
    );
  });

  test("order by", () => {
    expect("reduce a order by 1").toMakeAST(
      "queryStage",
      new ast.Reduce({
        fields: [mkFieldRefs("a")],
        orderBy: [new ast.OrderBy(1)],
      })
    );
  });

  test("order by limit", () => {
    expect("reduce a order by 1 limit 42").toMakeAST(
      "queryStage",
      new ast.Reduce({
        fields: [mkFieldRefs("a")],
        orderBy: [new ast.OrderBy(1)],
        limit: 42,
      })
    );
  });

  test("project everything", () => {
    expect("project : [state: 'ca'] a order by 1 limit 42").toMakeAST(
      "queryStage",
      new ast.Project({
        filter: caFilter,
        fields: [mkFieldRefs("a")],
        orderBy: [new ast.OrderBy(1)],
        limit: 42,
      })
    );
  });

  test("turtle", () => {
    const want = new ast.PipelineElement([], mkFieldName("turtleHead"));
    const trans = new TestTranslator("turtleHead", "pipeline");
    expect(trans).toBeValidMalloy();
    const turtleAST = trans.ast();
    expect(turtleAST).toEqualAST(want);
  });

  test("index", () => {
    expect("index").toMakeAST("queryStage", new ast.Index());
  });

  test("index field", () => {
    const oneField = new ast.Index();
    oneField.fields = [mkFieldRefs("a")];
    expect("index a").toMakeAST("queryStage", oneField);
  });

  test("index on", () => {
    const indexOn = new ast.Index();
    indexOn.on = mkFieldName("a");
    expect("index on a").toMakeAST("queryStage", indexOn);
  });

  test("index []", () => {
    const indexFiltered = new ast.Index();
    indexFiltered.filter = caFilter;
    expect("index [ state:'ca']").toMakeAST("queryStage", indexFiltered);
  });

  test("index limit", () => {
    const index = new ast.Index();
    index.limit = 42;
    expect("index limit 42").toMakeAST("queryStage", index);
  });
});

describe("query", () => {
  test("filtered turtle", () => {
    const src = `
      explore a | aturtle : [ state:'ca' ]
    `;
    const aturtle = new ast.PipelineElement([]);
    aturtle.addHead(mkFieldName("aturtle"), caFilter);
    const want = mkExploreOf("a", { pipeline: aturtle });
    expect(src).toMakeAST("explore", want);
  });

  test("named_explore", () => {
    expect("a").toMakeAST("explore", mkExploreOf("a"));
  });

  test("'table.name'", () => {
    expect("'aTable'").toMakeAST(
      "explore",
      new ast.Explore(new ast.TableSource("aTable"))
    );
  });

  test("optional keyword explore", () => {
    expect("explore a").toMakeAST("explore", mkExploreOf("a"));
  });

  test("( a )", () => {
    expect("(a)").toMakeAST(
      "explore",
      new ast.Explore(new ast.AnonymousSource(mkExploreOf("a")))
    );
  });

  test("primary key", () => {
    expect("a primary key b").toMakeAST(
      "explore",
      mkExploreOf("a", {
        primaryKey: new ast.PrimaryKey(new ast.FieldName("b")),
      })
    );
  });

  test("explore one field", () => {
    expect("a b is c").toMakeAST(
      "explore",
      mkExploreOf("a", {
        fields: [new ast.NameOnly(mkFieldName("c"), new ast.Filter([]), "b")],
      })
    );
  });

  test("filtered", () => {
    expect("a: [ state:'ca' ]").toMakeAST(
      "explore",
      mkExploreOf("a", { filter: caFilter })
    );
  });

  test("accept", () => {
    expect("a accept astring").toMakeAST(
      "explore",
      mkExploreOf("a", {
        fieldListEdit: new ast.FieldListEdit("accept", mkFieldRefs("astring")),
      })
    );
  });

  test("with pipeline", () => {
    expect("a | reduce astring").toMakeAST(
      "explore",
      mkExploreOf("a", {
        pipeline: new ast.PipelineElement([
          new ast.Reduce({ fields: [mkFieldRefs("astring")] }),
        ]),
      })
    );
  });

  test("with turtle pipe", () => {
    const want = mkExploreOf("a", {
      fields: [
        new ast.Turtle(
          new ast.PipelineElement([
            new ast.Reduce({
              fields: [
                mkFieldRefs("astring"),
                new ast.ExpressionFieldDef(
                  new ast.ExprCount(),
                  new ast.FieldName("val_count"),
                  "count(*)"
                ),
              ],
            }),
          ]),
          mkFieldName("by_string_val")
        ),
      ],
      pipeline: new ast.PipelineElement([], mkFieldName("by_string_val")),
    });
    expect(
      "a fields by_string_val is (reduce astring, val_count is count(*)) | by_string_val"
    ).toMakeAST("explore", want);
  });
});

describe("joins", () => {
  function join(nm: string, src: ast.Mallobj, ky: string): ast.Join {
    return new ast.Join(mkFieldName(nm), src, mkFieldName(ky));
  }

  test("b on k", () => {
    expect("b on k").toMakeAST(
      "join",
      join("b", new ast.NamedSource("b"), "k")
    );
  });
  test("d is b on k", () => {
    expect("d is b on k").toMakeAST(
      "join",
      join("d", new ast.NamedSource("b"), "k")
    );
  });
  test("d is (b) on k", () => {
    expect("d is (b) on k").toMakeAST(
      "join",
      join("d", new ast.AnonymousSource(mkExploreOf("b")), "k")
    );
  });
  test("d is 'table' on key", () => {
    expect("d is 'aTable' on k").toMakeAST(
      "join",
      join("d", new ast.TableSource("aTable"), "k")
    );
  });
});

describe("document", () => {
  function defineStatement(src: string) {
    const defParse = new TestTranslator(src, "defineStatement");
    expect(defParse).toBeValidMalloy();
    const def = defParse.ast() as ast.Define;
    expect(def).toBeDefined();
    return def;
  }

  test("define newA is explore a", () => {
    const got = defineStatement("define newA is (explore a)");
    const src = new ast.NamedSource("a");
    const want = new ast.Define("newA", new ast.Explore(src), false);
    expect(got).toEqualAST(want);
  });

  test("export define a is explore b", () => {
    const got = defineStatement("export define newA is (explore a)");
    const src = new ast.NamedSource("a");
    const want = new ast.Define("newA", new ast.Explore(src), true);
    expect(got).toEqualAST(want);
  });

  test("define three explores", () => {
    const srcCode = `
      export define newA is (a);
      define newB is (b);
      export define newBB is (newB)
    `;
    const docParse = new TestTranslator(srcCode);
    expect(docParse).toTranslate();
    const doc = docParse.ast() as ast.Document;
    expect(doc).toBeDefined();
    expect(doc.statements.length).toBe(3);
    for (const [index, eName] of ["newA", "newB", "newBB"].entries()) {
      const st = doc.statements[index];
      expect(st).toBeInstanceOf(ast.Define);
      expect((st as ast.Define).name).toBe(eName);
    }
  });

  test("simple import", () => {
    const docParse = new TestTranslator(`import "child"`);
    const xr = docParse.unresolved();
    expect(docParse).toBeErrorless();
    expect(xr).toEqual({ urls: ["internal://test/child"] });
    docParse.update({
      urls: { "internal://test/child": "export define aa is (explore a)" },
    });
    const yr = docParse.unresolved();
    expect(yr).toBeNull();
  });

  test("translator malformed root url", () => {
    const docParse = new MalloyTranslator("not_a_ful_path");
    const xr = docParse.unresolved();
    expect(xr).toBeNull();
    expect(docParse).not.toBeErrorless();
  });

  test.skip("import malformed url", () => {
    // skipped because it appears that any string does not parse as a full URL
    // is simply appended to the root as a relative URL
    const docParse = new TestTranslator(`import ":"`);
    const badRef = docParse.unresolved();
    expect(docParse).toBeErrorless();
    expect(badRef).toBeUndefined();
  });

  test("missing import", () => {
    const docParse = new TestTranslator(`import "child"`);
    const xr = docParse.unresolved();
    expect(docParse).toBeErrorless();
    expect(xr).toEqual({ urls: ["internal://test/child"] });
    const reportedError = "ENOWAY: No way to find your child";
    docParse.update({
      errors: { urls: { "internal://test/child": reportedError } },
    });
    expect(docParse).not.toTranslate();
    expect(docParse.prettyErrors()).toContain(reportedError);
  });

  test("chained imports", () => {
    const docParse = new TestTranslator(`import "child"`);
    docParse.update({
      urls: { "internal://test/child": `import "grandChild"` },
    });
    const xr = docParse.unresolved();
    expect(docParse).toBeErrorless();
    expect(xr).toEqual({ urls: ["internal://test/grandChild"] });
  });

  test("query lists", () => {
    const doc = new ast.Document([
      new ast.DocumentQuery(mkExploreOf("a"), 0),
      new ast.DocumentQuery(mkExploreOf("b"), 1),
    ]);
    expect("a;b").toMakeAST("malloyDocument", doc);
  });
});

describe("parameters", () => {
  test("required condition", () => {
    const paramList = [
      new ast.HasParameter({
        name: "aparam",
        isCondition: true,
        type: "timestamp",
      }),
    ];
    const def = new ast.Define("ap", mkExploreOf("a"), false, paramList);
    expect("define ap(has aparam : timestamp) is (a)").toMakeAST(
      "defineStatement",
      def
    );
  });

  test("optional value", () => {
    const when = ast.GranularLiteral.parse("@1960-06-30");
    expect(when).toBeDefined();
    if (when) {
      const paramList = [
        new ast.HasParameter({
          name: "aparam",
          isCondition: false,
          type: "timestamp",
          default: new ast.ConstantSubExpression(when),
        }),
      ];
      const def = new ast.Define("ap", mkExploreOf("a"), false, paramList);
      expect("define ap(has aparam timestamp or @1960-06-30) is (a)").toMakeAST(
        "defineStatement",
        def
      );
    }
  });

  test("constant value", () => {
    const when = ast.GranularLiteral.parse("@1960-06-30");
    expect(when).toBeDefined();
    if (when) {
      const cExpr = new ast.ConstantSubExpression(when);
      const paramList = [new ast.ConstantParameter("aparam", cExpr)];
      const def = new ast.Define("ap", mkExploreOf("a"), false, paramList);
      expect("define ap(has aparam @1960-06-30) is (a)").toMakeAST(
        "defineStatement",
        def
      );
    }
  });

  test("provide value in reference", () => {
    const ap = new ast.NamedSource("ap", {
      aparam: new ast.ConstantSubExpression(new ast.ExprString("'a'")),
      param2: new ast.ConstantSubExpression(new ast.ExprNumber("2")),
    });
    expect(`explore ap(aparam is 'a' param2 is 2)`).toMakeAST(
      "namelessQuery",
      new ast.DocumentQuery(new ast.Explore(ap), 0)
    );
  });
});

describe("syntax errors", () => {
  test.todo("errors with location report correct location");
  test.todo("errors with span report correct span");
});

describe("comments", () => {
  test("line comments", () => {
    expect("-- ^&*$(#HFDJKXU*(").toBeValidMalloy();
  });
  test("block comments", () => {
    expect("/* $&*#(&$%# */").toBeValidMalloy();
  });
});

describe("json support", () => {
  test("define using json", () => {
    const jsonModel = "export define js is json " + JSON.stringify(aTableDef);
    const jParse = new TestTranslator(jsonModel);
    expect(jParse).toTranslate();
    const jModel = jParse.translate().translated?.modelDef.structs;
    expect(jModel).toBeDefined();
    const js = jModel?.js;
    expect(js).toBeDefined();

    const malloyModel = "export define js is (explore 'aTable')";
    const mParse = new TestTranslator(malloyModel);
    const mModel = mParse.translate().translated?.modelDef.structs;
    expect(mParse).toTranslate();
    expect(mModel).toBeDefined();
    const mjs = mModel?.js;
    expect(mjs).toBeDefined();

    if (mjs && js) {
      expect(js).toEqual(mjs);
    }
  });
});

function findAndParseMalloyFiles(someDir: string) {
  // paths are relative to packages/malloy ... but depending on how jest
  // is set up, sometimes the directory is the project root ...
  if (process.cwd().endsWith("packages/malloy")) {
    someDir = "../../" + someDir;
  }
  describe(`parsing files in ${someDir}`, () => {
    let modelsFound = false;
    for (const fn of readdirSync(someDir)) {
      if (fn.match(/.malloy$/)) {
        modelsFound = true;
        test(`parsing ${fn}`, () => {
          const src = readFileSync(`${someDir}/${fn}`, "utf-8");
          expect(src).toBeValidMalloy();
        });
      }
    }
    expect(modelsFound).toBeTruthy();
  });
}

findAndParseMalloyFiles("packages/malloy/src/lang/test/malloy/parse");
