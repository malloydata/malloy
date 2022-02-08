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

import { makeSQLBlock } from "../../model/sql_block";
import { ExpressionDef } from "../ast";
import { StructSpace } from "../field-space";
import { DataRequestResponse } from "../parse-malloy";
import { TestTranslator, pretty, aTableDef } from "./test-translator";

const inspectCompile = false;

/*
 * Thinking of these tests as just "do things parse", there should maybe
 * be additional tests for, "does the correct code get generated", but
 * the first step should be to write all the phrases in the grammar
 * and make sure they parse to ast and the ast generates something
 */

abstract class Testable extends TestTranslator {
  abstract compile(): void;
}

class BetaModel extends Testable {
  constructor(s: string) {
    super(s);
  }

  compile(): void {
    const compileTo = this.translate();
    if (compileTo.translated && inspectCompile) {
      console.log("MODEL: ", pretty(compileTo.translated.modelDef));
      console.log("QUERIES: ", pretty(compileTo.translated.queryList));
    }
    // All the stuff to ask the ast for a translation is already in TestTranslator
  }

  unresolved(): DataRequestResponse {
    return this.importsAndTablesStep.step(this);
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toCompile(): R;
      toBeErrorless(): R;
    }
  }
}

function checkForErrors(trans: Testable) {
  if (trans.logger === undefined) {
    throw new Error("JESTERY BROKEN, CANT FIND ERORR LOG");
  }
  if (trans.logger.hasErrors()) {
    return {
      message: () => `Translation Errors:\n${trans.prettyErrors()}`,
      pass: false,
    };
  }
  return {
    message: () => "Translation resulted in no errors",
    pass: true,
  };
}

expect.extend({
  toCompile: function (x: Testable) {
    x.compile();
    return checkForErrors(x);
  },
  toBeErrorless: function (trans: Testable) {
    return checkForErrors(trans);
  },
});

class BetaExpression extends Testable {
  constructor(src: string) {
    super(src, "justExpr");
  }

  compile(): void {
    const exprAst = this.ast();
    if (exprAst instanceof ExpressionDef) {
      const aStruct = this.internalModel.contents.ab;
      if (aStruct.type === "struct") {
        const _exprDef = exprAst.getExpression(new StructSpace(aStruct));
      } else {
        throw new Error("Can't get simple namespace for expression tests");
      }
    } else if (this.logger.hasErrors()) {
      return;
    } else {
      const whatIsIt = exprAst?.toString() || "NO AST GENERATED";
      throw new Error(`Not an expression: ${whatIsIt}`);
    }
  }
}

type TestFunc = () => undefined;

function exprOK(s: string): TestFunc {
  return () => {
    expect(new BetaExpression(s)).toCompile();
    return undefined;
  };
}

function modelOK(s: string): TestFunc {
  return () => {
    const m = new BetaModel(s);
    expect(m).toCompile();
    return undefined;
  };
}

describe("model statements", () => {
  describe("explore:", () => {
    test("explore table", modelOK(`explore: testA is table('aTable')`));
    test(
      "explore shorcut fitlered table",
      modelOK(`
        explore: testA is table('aTable') {? astr ~ 'a%' }
      `)
    );
    test(
      "explore fitlered table",
      modelOK(`
        explore: testA is table('aTable') { where: astr ~ 'a%' }
      `)
    );
    test("explore explore", modelOK(`explore: testA is a`));
    test(
      "explore query",
      modelOK(`explore: testA is from(a->{group_by: astr})`)
    );
    test(
      "refine explore",
      modelOK(`explore: aa is a { dimension: a is astr }`)
    );
  });
  describe("query:", () => {
    test(
      "anonymous query",
      modelOK("query: table('aTable') -> { group_by: astr }")
    );
    test(
      "query",
      modelOK("query: name is table('aTable') -> { group_by: astr }")
    );
    test(
      "query from query",
      modelOK(
        `
          query: q1 is ab->{ group_by: astr limit: 10 }
          query: q2 is ->q1
        `
      )
    );
    test(
      "query with refinements from query",
      modelOK(
        `
          query: q1 is ab->{ group_by: astr limit: 10 }
          query: q2 is ->q1 { aggregate: acount }
        `
      )
    );
    test(
      "chained query operations",
      modelOK(`
        query: ab
          -> { group_by: astr; aggregate: acount }
          -> { top: 5; where: astr ~ 'a%' group_by: astr }
      `)
    );
    test(
      "query from explore from query",
      modelOK(
        `query: from(ab -> {group_by: astr}) { dimension: bigstr is UPPER(astr) } -> { group_by: bigstr }`
      )
    );
    test(
      "query with shortcut filtered turtle",
      modelOK("query: allA is ab->aturtle {? astr ~ 'a%' }")
    );
    test(
      "query with filtered turtle",
      modelOK("query: allA is ab->aturtle { where: astr ~ 'a%' }")
    );
    test(
      "nest: in group_by:",
      modelOK(`
        query: ab -> {
          group_by: astr;
          nest: nested_count is {
            aggregate: acount
          }
        }
      `)
    );
    test(
      "reduce pipe project",
      modelOK(`
        query: a -> { aggregate: f is count() } -> { project: f2 is f + 1 }
      `)
    );
  });
  describe("import:", () => {
    test("simple import", () => {
      const docParse = new BetaModel(`import "child"`);
      const xr = docParse.unresolved();
      expect(docParse).toBeErrorless();
      expect(xr).toEqual({ urls: ["internal://test/child"] });
      docParse.update({
        urls: { "internal://test/child": "explore: aa is a" },
      });
      const yr = docParse.unresolved();
      expect(yr).toBeNull();
    });
    test("missing import", () => {
      const docParse = new BetaModel(`import "child"`);
      const xr = docParse.unresolved();
      expect(docParse).toBeErrorless();
      expect(xr).toEqual({ urls: ["internal://test/child"] });
      const reportedError = "ENOWAY: No way to find your child";
      docParse.update({
        errors: { urls: { "internal://test/child": reportedError } },
      });
      docParse.translate();
      expect(docParse).not.toBeErrorless();
      expect(docParse.prettyErrors()).toContain(reportedError);
    });
    test("chained imports", () => {
      const docParse = new BetaModel(`import "child"`);
      docParse.update({
        urls: { "internal://test/child": `import "grandChild"` },
      });
      const xr = docParse.unresolved();
      expect(docParse).toBeErrorless();
      expect(xr).toEqual({ urls: ["internal://test/grandChild"] });
    });
  });
});

describe("explore properties", () => {
  test("single dimension", modelOK("explore: aa is a { dimension: x is 1 }"));
  test(
    "multiple dimensions",
    modelOK(`
      explore: aa is a {
        dimension: [
          x is 1
          y is 2
        ]
      }
    `)
  );
  test("single measure", modelOK("explore: aa is a { measure: x is count() }"));
  test(
    "multiple measures",
    modelOK(`
      explore: aa is a {
        dimension: [
          x is count()
          y is x * x
        ]
      }
    `)
  );
  test("single where", modelOK("explore: aa is a { where: ai > 10 }"));
  test(
    "multiple where",
    modelOK(`
      explore: aa is a {
        where: [
          ai > 10,
          af < 1000
        ]
      }
    `)
  );
  describe("joins", () => {
    test("with", modelOK("explore: x is a { join_one: b with astr }"));
    test("with", modelOK("explore: x is a { join_one: y is b with astr }"));
    test("one on", modelOK("explore: x is a { join_one: b on astr = b.astr }"));
    test(
      "one is on",
      modelOK("explore: x is a { join_one: y is b on astr = y.astr }")
    );
    test(
      "many on",
      modelOK("explore: nab is a { join_many: b on astr = b.astr }")
    );
    test(
      "many is on",
      modelOK("explore: y is a { join_many: x is b on astr = x.astr }")
    );
    test("cross", modelOK("explore: nab is a { join_cross: b }"));
    test("cross is", modelOK("explore: nab is a { join_cross: xb is b }"));
    test("cross on", modelOK("explore: nab is a { join_cross: b on true}"));
    test(
      "multiple joins",
      modelOK(`
        explore: nab is a {
          join_one: [
            b with astr,
            br is b with astr
          ]
        }
      `)
    );
  });
  test("primary_key", modelOK("explore: c is a { primary_key: ai }"));
  test("rename", modelOK("explore: c is a { rename: nn is ai }"));
  test("accept single", modelOK("explore: c is a { accept: astr }"));
  test("accept multi", modelOK("explore: c is a { accept: [ astr, af ] }"));
  test("except single", modelOK("explore: c is a { except: astr }"));
  test("except multi", modelOK("explore: c is a { except: [ astr, af ] }"));
  test(
    "explore-query",
    modelOK("explore: c is a {query: q is { group_by: astr }}")
  );
  test(
    "refined explore-query",
    modelOK(`
      explore: abNew is ab {
        query: for1 is aturtle {? ai = 1 }
      }
    `)
  );
  test(
    "chained explore-query",
    modelOK(`
      explore: c is a {
        query: chain is {
          group_by: astr
        } -> {
          top: 10; order_by: astr
          project: *
        }
      }
    `)
  );
  test(
    "multiple explore-query",
    modelOK(`
      explore: abNew is ab {
        query: [
          q1 is { group_by: astr },
          q2 is { group_by: ai }
        ]
      }
    `)
  );
});

describe("qops", () => {
  test("group by single", modelOK("query: a->{ group_by: astr }"));
  test("group_by x is x'", modelOK("query: a->{ group_by: ai is ai/2 }"));
  test("group by multiple", modelOK("query: a->{ group_by: [astr,ai] }"));
  test("aggregate single", modelOK("query: a->{ aggregate: num is count() }"));
  test(
    "aggregate multiple",
    modelOK(`
      query: a->{
        aggregate: [ num is count(), total is sum(ai) ]
      }
    `)
  );
  test("project ref", modelOK("query:ab->{ project: b.astr }"));
  test("project *", modelOK("query:ab->{ project: * }"));
  test("project def", modelOK("query:ab->{ project: one is 1 }"));
  test(
    "project multiple",
    modelOK(`
      query: a->{
        project: [ one is 1, astr ]
      }
    `)
  );
  test("index single", modelOK("query:a->{index: astr}"));
  test("index multiple", modelOK("query:a->{index: [astr,af]}"));
  test("index star", modelOK("query:a->{index: *}"));
  test("index by", modelOK("query:a->{index: * by ai}"));
  test("top N", modelOK("query: a->{ top: 5; group_by: astr }"));
  test("top N by field", modelOK("query: a->{top: 5 by af; group_by: astr}"));
  test(
    "top N by expression",
    modelOK("query: ab->{top: 5 by acount; group_by: astr}")
  );
  test("limit N", modelOK("query: a->{ limit: 5; group_by: astr }"));
  test("order by", modelOK("query: a->{ order_by: af; group_by: astr }"));
  test(
    "order by asc",
    modelOK("query: a->{ order_by: af asc; group_by: astr }")
  );
  test(
    "order by desc",
    modelOK("query: a->{ order_by: af desc; group_by: astr }")
  );
  test("order by N", modelOK("query: a->{ order_by: 1 asc; group_by: astr }"));
  test(
    "order by multiple",
    modelOK(`
      query: a->{
        order_by: [1 asc, af desc]
        group_by: [ astr, af ]
      }
    `)
  );
  test("where single", modelOK("query:a->{ group_by: astr; where: af > 10 }"));
  test(
    "having single",
    modelOK(
      "query:ab->{ aggregate: acount; group_by: astr; having: acount > 10 }"
    )
  );
  test(
    "where multiple",
    modelOK("query:a->{ group_by: astr; where: [af > 10,astr~'a%'] }")
  );
  test(
    "nest single",
    modelOK(`
      query: a->{
        group_by: ai
        nest: nestbystr is { group_by: astr; aggregate: N is count() }
      }
    `)
  );
  test(
    "nest multiple",
    modelOK(`
      query: a->{
        group_by: ai
        nest: [
          nestbystr is { group_by: astr; aggregate: N is count() },
          renest is { group_by: astr; aggregate: N is count() }
        ]
      }
    `)
  );
  test("nest ref", modelOK("query: ab->{group_by: ai; nest: aturtle}"));
});

describe("expressions", () => {
  describe("literals", () => {
    test("integer", exprOK("42"));
    test("string", exprOK(`'fortywo-two'`));
    test("string with \\'", exprOK(`'Isn` + `\\` + `'t this nice'`));
    test("string with \\\\", exprOK(`'Is ` + `\\` + `\\` + ` nice'`));
    test("year", exprOK("@1960"));
    test("quarter", exprOK("@1960-Q1"));
    test("week", exprOK("@WK1960-06-26"));
    test("month", exprOK("@1960-06"));
    test("day", exprOK("@1960-06-30"));
    test("minute", exprOK("@1960-06-30 10:30"));
    test("second", exprOK("@1960-06-30 10:30:31"));
    test("null", exprOK("null"));
    test("now", exprOK("now"));
    test("true", exprOK("true"));
    test("false", exprOK("false"));
    test("regex", exprOK("r'RegularExpression'"));
  });

  describe("timeframes", () => {
    const timeframes = [
      "second",
      "minute",
      "hour",
      "day",
      "week",
      "month",
      "quarter",
      "year",
    ];

    describe("timestamp truncation", () => {
      for (const unit of timeframes) {
        test(`timestamp truncate ${unit}`, exprOK(`ats.${unit}`));
      }
    });

    describe("timestamp extraction", () => {
      for (const unit of timeframes) {
        // TODO expect these to error ...
        test(`timestamp extract ${unit}`, exprOK(`${unit}(ats)`));
      }
    });
  });

  test("field name", exprOK("astr"));
  test("function call", exprOK("CURRENT_TIMESTAMP()"));

  describe("operators", () => {
    test("addition", exprOK("42 + 7"));
    test("subtraction", exprOK("42 - 7"));
    test("multiplication", exprOK("42 * 7"));
    test("division", exprOK("42 / 7"));
    test("unary negation", exprOK("- ai"));
    test("equal", exprOK("42 = 7"));
    test("not equal", exprOK("42 != 7"));
    test("greater than", exprOK("42 > 7"));
    test("greater than or equal", exprOK("42 >= 7"));
    test("less than or equal", exprOK("42 <= 7"));
    test("less than", exprOK("42 < 7"));
    test("match", exprOK("'forty-two' ~ 'fifty-four'"));
    test("not match", exprOK("'forty-two' !~ 'fifty-four'"));
    test("apply", exprOK("'forty-two' : 'fifty-four'"));
    test("not", exprOK("not true"));
    test("and", exprOK("true and false"));
    test("or", exprOK("true or false"));
  });

  test("filtered measure", exprOK("acount {? astr = 'why?' }"));
  describe("aggregate forms", () => {
    test("count", exprOK("count()"));
    test("count distinct", exprOK("count(distinct astr)"));
    test("join.count()", exprOK("b.count()"));
    for (const f of ["sum", "min", "max", "avg"]) {
      const fOfT = `${f}(af)`;
      test(fOfT, exprOK(fOfT));
      if (f !== "min" && f !== "max") {
        const joinDot = `b.af.${f}()`;
        test(joinDot, exprOK(joinDot));
        const joinAgg = `b.${f}(af)`;
        test(joinAgg, exprOK(joinAgg));
      }
    }
  });

  describe("pick statements", () => {
    test(
      "full",
      exprOK(`
        pick 'the answer' when ai = 42
        pick 'the questionable answer' when ai = 54
        else 'random'
    `)
    );
    test(
      "applied",
      exprOK(`
        astr:
          pick 'the answer' when = '42'
          pick 'the questionable answer' when = '54'
          else 'random'
    `)
    );
    test(
      "filtering",
      exprOK(`
        astr: pick 'missing value' when NULL
    `)
    );
    test(
      "tiering",
      exprOK(`
      ai:
        pick 1 when < 10
        pick 10 when < 100
        pick 100 when < 1000
        else 10000
  `)
    );
    test(
      "transforming",
      exprOK(`
        ai:
          pick 'small' when < 10
          pick 'medium' when < 100
          else 'large'
    `)
    );
  });
});

describe("sql backdoor", () => {
  test(
    "single sql statement",
    modelOK("sql: users is || SELECT * FROM USERS;;")
  );
  test("explore from sql", () => {
    const model = new BetaModel(`
      sql: users IS || SELECT * FROM aTable ;;
      explore: malloyUsers is from_sql(users) { primary_key: ai }
    `);
    const needReq = model.translate();
    expect(model).toBeErrorless();
    const needs = needReq?.sqlStructs;
    expect(needs).toBeDefined();
    if (needs) {
      expect(needs.length).toBe(1);
      const sql = makeSQLBlock({ select: " SELECT * FROM aTable " });
      expect(needs[0]).toMatchObject(sql);
      const refKey = needs[0].digest;
      expect(refKey).toBeDefined();
      if (refKey) {
        model.update({
          sqlStructs: { [refKey]: aTableDef },
        });
        expect(model).toCompile();
      }
    }
  });
});

describe("error handling", () => {
  test("query reference to undefined explore", () => {
    const m = new BetaModel("query: x->{ group_by: y }");
    expect(m).not.toCompile();
    const errList = m.errors().errors;
    const firstError = errList[0];
    expect(firstError.message).toBe("Undefined data source 'x'");
  });

  test("join reference before definition", () => {
    const m = new BetaModel(`
    explore: newAB is a { join_one: newB is bb on astring }
    explore: newB is b
    `);
    expect(m).not.toCompile();
    const errList = m.errors().errors;
    const firstError = errList[0];
    expect(firstError.message).toBe("Undefined data source 'bb'");
  });
  test("non-rename rename", () => {
    const m = new BetaModel("explore: na is a { rename: astr is astr }");
    expect(m).not.toCompile();
    const errList = m.errors().errors;
    const firstError = errList[0];
    expect(firstError.message).toBe("Can't rename field to itself");
  });
  test("reference to field in its definition", () => {
    const m = new BetaModel(`
      explore: na is a {
        dimension: astr is UPPER(astr)
      }
    `);
    expect(m).not.toCompile();
    const errList = m.errors().errors;
    const firstError = errList[0];
    expect(firstError.message).toBe(
      "Circular reference to 'astr' in definition"
    );
  });
  test("empty document", modelOK("\n"));
  // test("queries with anonymous expressions", () => {
  //   const m = new BetaModel("query: a->{\n group_by: a+1\n}");
  //   expect(m).not.toCompile();
  //   const errList = m.errors().errors;
  //   const firstError = errList[0];
  //   expect(firstError.message).toBe("Expressions in queries must have names");
  // });
});
