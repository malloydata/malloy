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

import { TranslateResponse } from "..";
import {
  DocumentLocation,
  DocumentPosition,
  SQLBlock,
  StructDef,
} from "../../model";
import { makeSQLBlock } from "../../model/sql_block";
import { ExpressionDef } from "../ast";
import { StaticSpace } from "../field-space";
import { DataRequestResponse } from "../parse-malloy";
import {
  TestTranslator,
  pretty,
  aTableDef,
  getExplore,
  getField,
  getQueryField,
  getModelQuery,
  getJoinField,
  markSource,
  MarkedSource,
} from "./test-translator";
import { isEqual } from "lodash";
import { inspect } from "util";

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
      toTranslate(): R;
      toReturnType(tp: string): R;
      compileToFailWith(expectedError: string): R;
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
    message: () => "Unexpected error free translation",
    pass: true,
  };
}

function prettyNeeds(response: TranslateResponse) {
  let needString = "";
  if (response.tables) {
    needString += "Tables:\n";
    response.tables.forEach((table) => (needString += `  - ${table}`));
  }
  if (response.sqlStructs) {
    needString += "SQL Structs:\n";
    response.sqlStructs.forEach(
      (sql) => (needString += `  - ${sql.as || "(unnamed sql struct)"}`)
    );
  }
  if (response.urls) {
    needString += "URLs:\n";
    response.urls.forEach((url) => (needString += `  - ${url}`));
  }
  return needString;
}

function checkForNeededs(trans: Testable) {
  const response = trans.translateStep.step(trans);
  if (!response.final) {
    return {
      message: () =>
        `Translation is not complete, needs:\n${prettyNeeds(response)}`,
      pass: false,
    };
  }
  return {
    message: () => "Unexpected complete translation",
    pass: true,
  };
}

expect.extend({
  toCompile: function (x: Testable) {
    x.compile();
    return checkForErrors(x);
  },
  toTranslate: function (x: Testable) {
    x.compile();
    const errorCheck = checkForErrors(x);
    if (!errorCheck.pass) {
      return errorCheck;
    }
    x.translate();
    return checkForNeededs(x);
  },
  toBeErrorless: function (trans: Testable) {
    return checkForErrors(trans);
  },
  toReturnType: function (functionCall: string, returnType: string) {
    const exprModel = new BetaModel(
      `explore: x is a { dimension: d is ${functionCall} }`
    );
    const tx = exprModel.translate();
    expect(exprModel).toTranslate();
    const model = tx.translated?.modelDef;
    if (model) {
      const x = model.contents.x;
      expect(x).toBeDefined();
      if (x?.type == "struct") {
        const d = x.fields.find((f) => f.name === "d");
        expect(d?.type).toBe(returnType);
      }
    }
    return {
      pass: true,
      message: () => "",
    };
  },
  compileToFailWith: function (s: MarkedSource | string, msg: string) {
    const src = typeof s == "string" ? s : s.code;
    const emsg = `Compile Error expectation not met\nExpected error: '${msg}'\nSource:\n${src}`;
    const m = new BetaModel(src);
    const t = m.translate();
    if (t.translated) {
      return { pass: false, message: () => emsg };
    } else {
      const errList = m.errors().errors;
      const firstError = errList[0];
      if (firstError.message != msg) {
        return {
          pass: false,
          message: () => `Received errror: ${firstError.message}\n${emsg}`,
        };
      }
      if (typeof s != "string") {
        const have = errList[0].at?.range;
        const want = s.locations[0].range;
        if (!this.equals(have, want)) {
          return {
            pass: false,
            message: () =>
              `Expected location: ${inspect(want)}\n` +
              `Received location: ${inspect(have)}\n${emsg}`,
          };
        }
      }
    }
    return { pass: true, message: () => `Found expected error '${msg}` };
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
        const exprDef = exprAst.getExpression(new StaticSpace(aStruct));
        if (inspectCompile) {
          console.log("EXPRESSION: ", pretty(exprDef));
        }
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
    expect(m).toTranslate();
    return undefined;
  };
}

function badModel(s: MarkedSource | string, msg: string): TestFunc {
  return () => {
    const src = typeof s == "string" ? s : s.code;
    const emsg = `Error expectation not met\nExpected error: '${msg}'\nSource:\n${src}`;
    const m = new BetaModel(src);
    const t = m.translate();
    if (t.translated) {
      fail(emsg);
    } else {
      const errList = m.errors().errors;
      const firstError = errList[0];
      if (firstError.message != msg) {
        fail(`Received errror: ${firstError.message}\n${emsg}`);
      }
      if (typeof s != "string") {
        if (!isEqual(errList[0].at, s.locations[0])) {
          fail(
            `Expected location: ${s.locations[0]}\n` +
              `Received location: ${errList[0].at}\n${emsg}`
          );
        }
      }
    }
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
    test(
      "refine and extend query",
      modelOK(`
        query: a_by_str is a -> { group_by: astr }
        query: -> a_by_str { aggregate: str_count is count() }
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
        dimension:
          x is 1
          y is 2
      }
    `)
  );
  test("single declare", modelOK("explore: aa is a { declare: x is 1 }"));
  test(
    "multiple declare",
    modelOK(`
      explore: aa is a {
        declare:
          x is 1
          y is 2
      }
    `)
  );
  test("single measure", modelOK("explore: aa is a { measure: x is count() }"));
  test(
    "multiple measures",
    modelOK(`
      explore: aa is a {
        dimension:
          x is count()
          y is x * x
      }
    `)
  );
  test("single where", modelOK("explore: aa is a { where: ai > 10 }"));
  test(
    "multiple where",
    modelOK(`
      explore: aa is a {
        where:
          ai > 10,
          af < 1000
      }
    `)
  );
  describe("joins", () => {
    test("with", modelOK("explore: x is a { join_one: b with astr }"));
    test("with", modelOK("explore: x is a { join_one: y is b with astr }"));
    test(
      "with dotted ref",
      modelOK("explore: x is ab { join_one: xz is a with b.astr }")
    );
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
          join_one:
            b with astr,
            br is b with astr
        }
      `)
    );
    test("with requires primary key", () => {
      expect(
        markSource`
          source: nb is b {
            join_one: ${"bb is table('aTable') with astr"}
          }
        `
      ).compileToFailWith(
        "join_one: Cannot use with unless source has a primary key"
      );
    });
  });
  test("primary_key", modelOK("explore: c is a { primary_key: ai }"));
  test("rename", modelOK("explore: c is a { rename: nn is ai }"));
  test("accept single", modelOK("explore: c is a { accept: astr }"));
  test("accept multi", modelOK("explore: c is a { accept: astr, af }"));
  test("except single", modelOK("explore: c is a { except: astr }"));
  test("except multi", modelOK("explore: c is a { except: astr, af }"));
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
        query:
          q1 is { group_by: astr },
          q2 is { group_by: ai }
      }
    `)
  );
});

describe("qops", () => {
  test("group by single", modelOK("query: a->{ group_by: astr }"));
  test("group_by x is x'", modelOK("query: a->{ group_by: ai is ai/2 }"));
  test("group by multiple", modelOK("query: a->{ group_by: astr,ai }"));
  test("aggregate single", modelOK("query: a->{ aggregate: num is count() }"));
  test(
    "aggregate multiple",
    modelOK(`
      query: a->{
        aggregate: num is count(), total is sum(ai)
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
        project: one is 1, astr
      }
    `)
  );
  test("index single", modelOK("query:a->{index: astr}"));
  test("index multiple", modelOK("query:a->{index: astr,af}"));
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
        order_by: 1 asc, af desc
        group_by: astr, af
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
    modelOK("query:a->{ group_by: astr; where: af > 10,astr~'a%' }")
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
        nest:
          nestbystr is { group_by: astr; aggregate: N is count() },
          renest is { group_by: astr; aggregate: N is count() }
      }
    `)
  );
  test("nest ref", modelOK("query: ab->{group_by: ai; nest: aturtle}"));
  test("refine query with extended source", () => {
    const m = new BetaModel(`
      source: nab is ab {
        query: xturtle is aturtle + {
          declare: aratio is ai / acount
        }
      }
      query: nab -> xturtle + { aggregate: aratio }
    `);
    expect(m).toTranslate();
    const t = m.translate();
    if (t.translated) {
      const q = t.translated.queryList[0].pipeline[0];
      if (q.type == "reduce" && q.extendSource) {
        expect(q.extendSource.length).toBe(1);
        const f = q.extendSource[0];
        expect(f.type).toBe("number");
        if (f.type == "number") {
          expect(f.aggregate).toBeTruthy();
        }
      } else {
        fail("Did not generate extendSource");
      }
    }
  });
  test("refine query source with field", () => {
    const m = new BetaModel(`
      query: ab -> aturtle + {
        declare: aratio is ai / acount
        aggregate: aratio
      }
    `);
    expect(m).toTranslate();
    const t = m.translate();
    if (t.translated) {
      const q = t.translated.queryList[0].pipeline[0];
      if (q.type == "reduce" && q.extendSource) {
        expect(q.extendSource.length).toBe(1);
        const f = q.extendSource[0];
        expect(f.type).toBe("number");
        if (f.type == "number") {
          expect(f.aggregate).toBeTruthy();
        }
      } else {
        fail("Did not generate extendSource");
      }
    }
  });
  test("refine query source with join", () => {
    const m = new BetaModel(`
      query: ab -> aturtle + {
        join_one: bb is b on bb.astr = astr
        group_by: foo is bb.astr
      }
    `);
    expect(m).toTranslate();
    const t = m.translate();
    if (t.translated) {
      const q = t.translated.queryList[0].pipeline[0];
      if (q.type == "reduce" && q.extendSource) {
        expect(q.extendSource.length).toBe(1);
        expect(q.extendSource[0].type).toBe("struct");
      } else {
        fail("Did not generate extendSource");
      }
    }
  });
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

    test(
      "when single values",
      exprOK(`
        ai :
          pick 'one' when 1
          else 'a lot'
      `)
    );
  });
});

describe("sql backdoor", () => {
  function makeSchemaResponse(sql: SQLBlock): StructDef {
    return {
      type: "struct",
      name: sql.name,
      dialect: "standardsql'",
      structSource: {
        type: "sql",
        method: "subquery",
        sqlBlock: { ...sql },
      },
      structRelationship: { type: "basetable", connectionName: "bigquery" },
      fields: aTableDef.fields,
    };
  }
  test(
    "single sql statement",
    modelOK("sql: users is || SELECT * FROM USERS;;")
  );
  test("explore from sql", () => {
    const model = new BetaModel(`
      sql: users IS || SELECT * FROM aTable ;;
      source: malloyUsers is from_sql(users) { primary_key: ai }
    `);
    const needReq = model.translate();
    expect(model).toBeErrorless();
    const needs = needReq?.sqlStructs;
    expect(needs).toBeDefined();
    if (needs) {
      expect(needs.length).toBe(1);
      const sql = makeSQLBlock({ select: " SELECT * FROM aTable " });
      expect(needs[0]).toMatchObject(sql);
      const refKey = needs[0].name;
      expect(refKey).toBeDefined();
      if (refKey) {
        model.update({ sqlStructs: { [refKey]: makeSchemaResponse(sql) } });
        expect(model).toTranslate();
      }
    }
  });
  test("explore from imported sql-based-source", () => {
    const createModel = `
      sql: users IS || SELECT * FROM aTable ;;
      source: malloyUsers is from_sql(users) { primary_key: ai }
    `;
    const model = new BetaModel(`
      import "createModel.malloy"
      source: foo is malloyUsers
    `);
    model.importZone.define("internal://test/createModel.malloy", createModel);
    const needReq = model.translate();
    expect(model).toBeErrorless();
    const needs = needReq?.sqlStructs;
    expect(needs).toBeDefined();
    if (needs) {
      expect(needs.length).toBe(1);
      const sql = makeSQLBlock({ select: " SELECT * FROM aTable " });
      expect(needs[0]).toMatchObject(sql);
      const refKey = needs[0].name;
      expect(refKey).toBeDefined();
      if (refKey) {
        model.update({ sqlStructs: { [refKey]: makeSchemaResponse(sql) } });
        expect(model).toTranslate();
      }
    }
  });
});

describe("error handling", () => {
  test("query reference to undefined explore", () => {
    expect(markSource`query: ${"x"}->{ group_by: y }`).compileToFailWith(
      "Undefined source 'x'"
    );
  });
  test("join reference before definition", () => {
    expect(
      markSource`
        explore: newAB is a { join_one: newB is ${"bb"} on astring }
        explore: newB is b
      `
    ).compileToFailWith("Undefined source 'bb'");
  });
  test(
    "non-rename rename",
    badModel(
      "explore: na is a { rename: astr is astr }",
      "Can't rename field to itself"
    )
  );
  test(
    "reference to field in its definition",
    badModel(
      `explore: na is a { dimension: astr is UPPER(astr) } `,
      "Circular reference to 'astr' in definition"
    )
  );
  test("empty model", modelOK(""));
  test("one line model ", modelOK("\n"));
  test(
    "query without fields",
    badModel(
      `query: a -> { top: 5 }`,
      "Can't determine query type (group_by/aggregate/nest,project,index)"
    )
  );
  test(
    "refine can't change query type",
    badModel(
      `query: ab -> aturtle { project: astr }`,
      "project: not legal in grouping query"
    )
  );
  test(
    "undefined field ref in query",
    badModel(`query: ab -> { aggregate: xyzzy }`, "'xyzzy' is not defined")
  );
  // test("queries with anonymous expressions", () => {
  //   const m = new BetaModel("query: a->{\n group_by: a+1\n}");
  //   expect(m).not.toCompile();
  //   const errList = m.errors().errors;
  //   const firstError = errList[0];
  //   expect(firstError.message).toBe("Expressions in queries must have names");
  // });
  test("query on source with errors", () => {
    expect(markSource`
        explore: na is a { join_one: ${"n"} on astr }
        // query: na -> { project: * }
      `).compileToFailWith("Undefined source 'n'");
  });

  test("detect duplicate output field names", () => {
    expect(
      markSource`query: ab -> { group_by: astr, ${"astr"} }`
    ).compileToFailWith("Output already has a field named 'astr'");
  });
  test("detect join tail overlap existing ref", () => {
    expect(
      markSource`query: ab -> { group_by: astr, ${"b.astr"} }`
    ).compileToFailWith("Output already has a field named 'astr'");
  });
  test("undefined in expression with regex compare", () => {
    expect(
      `
        source: c is a {
          dimension: d is meaning_of_life ~ r'(forty two|fifty four)'
        }
      `
    ).compileToFailWith("'meaning_of_life' is not defined");
  });
});

function getSelectOneStruct(sqlBlock: SQLBlock): StructDef {
  return {
    type: "struct",
    name: sqlBlock.name,
    dialect: "bigquery",
    structSource: {
      type: "sql",
      method: "subquery",
      sqlBlock,
    },
    structRelationship: { type: "basetable", connectionName: "bigquery" },
    fields: [{ type: "number", name: "one" }],
  };
}

describe("source locations", () => {
  test("renamed explore location", () => {
    const source = markSource`explore: ${"na is a"}`;
    const m = new BetaModel(source.code);
    expect(m).toCompile();
    expect(getExplore(m.modelDef, "na").location).toMatchObject(
      source.locations[0]
    );
  });

  test("refined explore location", () => {
    const source = markSource`explore: ${"na is a {}"}`;
    const m = new BetaModel(source.code);
    expect(m).toCompile();
    expect(getExplore(m.modelDef, "na").location).toMatchObject(
      source.locations[0]
    );
  });

  test("location of defined dimension", () => {
    const source = markSource`explore: na is a { dimension: ${"x is 1"} }`;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const x = getField(na, "x");
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test("location of defined measure", () => {
    const source = markSource`explore: na is a { measure: ${"x is count()"} }`;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const x = getField(na, "x");
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test("location of defined query", () => {
    const source = markSource`explore: na is a { query: ${"x is { group_by: y is 1 }"} }`;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const x = getField(na, "x");
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test("location of defined field inside a query", () => {
    const source = markSource`
      explore: na is a {
        query: x is {
          group_by: ${"y is 1"}
        }
      }`;

    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const x = getQueryField(na, "x");
    const y = getField(x.pipeline[0], "y");
    expect(y.location).toMatchObject(source.locations[0]);
  });

  test("location of filtered field inside a query", () => {
    const source = markSource`
      explore: na is a {
        measure: y is count()
        query: x is {
          group_by: ${"z is y { where: true }"}
        }
      }`;

    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const x = getQueryField(na, "x");
    const z = getField(x.pipeline[0], "z");
    expect(z.location).toMatchObject(source.locations[0]);
  });

  test("location of field inherited from table", () => {
    const source = markSource`explore: na is ${"table('aTable')"}`;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const abool = getField(na, "abool");
    expect(abool.location).toMatchObject(source.locations[0]);
  });

  test("location of field inherited from sql block", () => {
    const source = markSource`
      sql: ${"s is || SELECT 1 as one ;;"}

      explore: na is from_sql(s)
    `;
    const m = new BetaModel(source.code);
    const result = m.translate();
    const sqlBlock = (result.sqlStructs || [])[0];
    m.update({
      sqlStructs: {
        [sqlBlock.name]: getSelectOneStruct(sqlBlock),
      },
    });
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const one = getField(na, "one");
    expect(one.location).toMatchObject(source.locations[0]);
  });

  test("location of fields inherited from a query", () => {
    const source = markSource`
      explore: na is from(
        ${"table('aTable')"} -> {
          group_by:
            abool
            ${"y is 1"}
        }
      )
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const abool = getField(na, "abool");
    expect(abool.location).toMatchObject(source.locations[0]);
    const y = getField(na, "y");
    expect(y.location).toMatchObject(source.locations[1]);
  });

  test("location of named query", () => {
    const source = markSource`query: ${"q is a -> { project: * }"}`;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const q = getExplore(m.modelDef, "q");
    expect(q.location).toMatchObject(source.locations[0]);
  });

  test("location of field in named query", () => {
    const source = markSource`query: q is a -> { group_by: ${"b is 1"} }`;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const q = getModelQuery(m.modelDef, "q");
    const a = getField(q.pipeline[0], "b");
    expect(a.location).toMatchObject(source.locations[0]);
  });

  test("location of named SQL block", () => {
    const source = markSource`sql: ${"s is || SELECT 1 as one ;;"}`;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const s = m.sqlBlocks[0];
    expect(s.location).toMatchObject(source.locations[0]);
  });

  test("location of renamed field", () => {
    const source = markSource`
      explore: na is a {
        rename: ${"bbool is abool"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const bbool = getField(na, "bbool");
    expect(bbool.location).toMatchObject(source.locations[0]);
  });

  test("location of join on", () => {
    const source = markSource`
      explore: na is a {
        join_one: ${"x is a { primary_key: abool } on abool"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const x = getField(na, "x");
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test("location of join with", () => {
    const source = markSource`
      explore: na is a {
        join_one: ${"x is a { primary_key: astr } with astr"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const x = getField(na, "x");
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test("location of field in join", () => {
    const source = markSource`
      explore: na is a {
        join_one: x is a {
          primary_key: abool
          dimension: ${"y is 1"}
        } on abool
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, "na");
    const x = getJoinField(na, "x");
    const y = getField(x, "y");
    expect(y.location).toMatchObject(source.locations[0]);
  });

  test("multi line sql block token span is correct", () => {
    // There is exactly one token in this file ..
    const sqlSource = "|| // line 0\n//line 1\n// line 2;;";
    const m = new BetaModel(sqlSource);
    expect(m).not.toCompile();
    const errList = m.errors().errors;
    expect(errList[0].at?.range.end).toEqual({ line: 2, character: 11 });
  });

  test(
    "undefined query location",
    badModel(
      markSource`query: ${"-> xyz"}`,
      "Reference to undefined query 'xyz'"
    )
  );
  test(
    "undefined field reference",
    badModel(
      markSource`query: a -> { group_by: ${"xyz"} }`,
      "'xyz' is not defined"
    )
  );
  test(
    "bad query",
    badModel(
      markSource`query: a -> { group_by: astr; ${"project: *"} }`,
      "project: not legal in grouping query"
    )
  );

  test.skip(
    "undefined field reference in top",
    badModel(
      markSource`query: a -> { group_by: one is 1; top: 1 by ${"xyz"} }`,
      "'xyz' is not defined"
    )
  );

  test.skip(
    "undefined field reference in order_by",
    badModel(
      markSource`query: a -> { group_by: one is 1; order_by: ${"xyz"} }`,
      "'xyz' is not defined"
    )
  );
});

describe("source references", () => {
  test("reference to explore", () => {
    const source = markSource`
      explore: ${"na is a"}
      query: ${"na"} -> { project: * }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "exploreReference",
      text: "na",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to query in query", () => {
    const source = markSource`
      explore: t is a {
        query: ${"q is { project: * }"}
      }
      query: t -> ${"q"}
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "q",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to query in query (version 2)", () => {
    const source = markSource`
      explore: na is a { query: ${"x is { group_by: y is 1 }"} }
      query: na -> ${"x"}
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "x",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to sql block", () => {
    const source = markSource`
      sql: ${"s is || SELECT 1 as one ;;"}
      explore: na is from_sql(${"s"})
    `;
    const m = new BetaModel(source.code);
    const result = m.translate();
    const sqlBlock = (result.sqlStructs || [])[0];
    m.update({
      sqlStructs: {
        [sqlBlock.name]: getSelectOneStruct(sqlBlock),
      },
    });
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "sqlBlockReference",
      text: "s",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to query in from", () => {
    const source = markSource`
      query: ${"q is a -> { project: * }"}
      explore: na is from(-> ${"q"})
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "queryReference",
      text: "q",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to query in query head", () => {
    const source = markSource`
      query: ${"q is a -> { project: * }"}
      query: q2 is -> ${"q"} -> { project: * }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "queryReference",
      text: "q",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to query in refined query", () => {
    const source = markSource`
      query: ${"q is a -> { project: * }"}
      query: q2 is -> ${"q"} { limit: 10 }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "queryReference",
      text: "q",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field in expression", () => {
    const source = markSource`
      explore: na is ${"table('aTable')"}
      query: na -> { project: bbool is not ${"abool"} }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to quoted field in expression", () => {
    const source = markSource`
      explore: na is a {
        dimension: ${"`name` is 'name'"}
      }
      query: na -> { project: ${"`name`"} }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "name",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to joined field in expression", () => {
    const source = markSource`
      explore: na is a {
        join_one: self is ${"table('aTable')"}
          on astr = self.astr
      }
      query: na -> { project: bstr is self.${"astr"} }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "astr",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to joined join in expression", () => {
    const source = markSource`
      explore: na is a {
        join_one: ${"self is a on astr = self.astr"}
      }
      query: na -> { project: bstr is ${"self"}.astr }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "joinReference",
      text: "self",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field not in expression (group by)", () => {
    const source = markSource`
      query: ${"table('aTable')"} -> { group_by: ${"abool"} }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field not in expression (project)", () => {
    const source = markSource`
      explore: na is ${"table('aTable')"}
      query: na -> { project: ${"abool"} }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip("reference to field in order by", () => {
    const source = markSource`
      query: ${"table('aTable')"} -> {
        group_by: abool
        order_by: ${"abool"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip("reference to field in order by (output space)", () => {
    const source = markSource`
      query: a -> {
        group_by: ${"one is 1"}
        order_by: ${"one"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field in aggregate", () => {
    const source = markSource`
      query: a { measure: ${"c is count()"} } -> {
        group_by: abool
        aggregate: ${"c"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "c",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field in measure", () => {
    const source = markSource`
      explore: e is a {
        measure: ${"c is count()"}
        measure: c2 is ${"c"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "c",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip("reference to field in top", () => {
    const source = markSource`
      query: ${"table('aTable')"} -> {
        group_by: abool
        top: 10 by ${"abool"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip("reference to field in top (output space)", () => {
    const source = markSource`
      query: a -> {
        group_by: ${"one is 1"}
        top: 10 by ${"one"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field in filter", () => {
    const source = markSource`
      query: ${"table('aTable')"} -> {
        group_by: abool
        where: ${"abool"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field in aggregate source", () => {
    const source = markSource`
      explore: na is ${"table('aTable')"}
      query: na -> { aggregate: ai_sum is ${"ai"}.sum() }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "ai",
      definition: {
        location: source.locations[0],
      },
    });
  });

  function pos(location: DocumentLocation): DocumentPosition {
    return location.range.start;
  }

  test("reference to join in aggregate source", () => {
    const source = markSource`
      explore: na is a {
        join_one: ${"self is a on astr = self.astr"}
      }
      query: na -> { aggregate: ai_sum is ${"self"}.sum(self.ai) }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "joinReference",
      text: "self",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to join in aggregate in expr", () => {
    const source = markSource`
      explore: na is a {
        join_one: ${"self is a on astr = self.astr"}
      }
      query: na -> { aggregate: ai_sum is self.sum(${"self"}.ai) }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "joinReference",
      text: "self",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to explore in join", () => {
    const source = markSource`
      explore: ${"exp1 is a"}
      explore: exp2 is a {
        join_one: ${"exp1"} on astr = exp1.astr
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "exploreReference",
      text: "exp1",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field in aggregate (in expr)", () => {
    const source = markSource`
      explore: na is ${"table('aTable')"}
      query: na -> { aggregate: ai_sum is sum(${"ai"}) }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "ai",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field in rename", () => {
    const source = markSource`
      explore: na is ${"table('aTable')"} {
        rename: bbool is ${"abool"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "abool",
      definition: {
        location: source.locations[0],
      },
    });
  });

  test("reference to field in join with", () => {
    const source = markSource`
      explore: exp1 is a { primary_key: astr }
      explore: exp2 is ${"table('aTable')"} {
        join_one: exp1 with ${"astr"}
      }
    `;
    const m = new BetaModel(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: "fieldReference",
      text: "astr",
      definition: {
        location: source.locations[0],
      },
    });
  });
});

describe("translation need error locations", () => {
  test("import error location", () => {
    const source = markSource`import ${'"badfile"'}`;
    const m = new BetaModel(source.code);
    const result = m.translate();
    m.update({
      errors: { urls: { [(result.urls || [])[0]]: "Bad file!" } },
    });
    expect(m).not.toCompile();
    const errList = m.errors().errors;
    expect(errList[0].at).toEqual(source.locations[0]);
    return undefined;
  });

  test("sql struct error location", () => {
    const source = markSource`
      sql: bad_sql is || BAD SQL ;;
      query: ${"from_sql(bad_sql)"} -> { project: * }
    `;
    const m = new BetaModel(source.code);
    const result = m.translate();
    m.update({
      errors: {
        sqlStructs: { [(result.sqlStructs || [])[0].name]: "Bad SQL!" },
      },
    });
    expect(m).not.toCompile();
    const errList = m.errors().errors;
    expect(errList[0].at).toEqual(source.locations[0]);
    return undefined;
  });

  test("table struct error location", () => {
    const source = markSource`
      explore: bad_explore is ${"table('malloy-data.bad.table')"}
    `;
    const m = new BetaModel(source.code);
    const result = m.translate();
    m.update({
      errors: {
        tables: { [(result.tables || [])[0]]: "Bad table!" },
      },
    });
    expect(m).not.toCompile();
    const errList = m.errors().errors;
    expect(errList[0].at).toEqual(source.locations[0]);
    return undefined;
  });
});

describe("pipeline comprehension", () => {
  test(
    "second query gets namespace from first",
    modelOK(`
      explore: aq is a {
        query: t1 is {
          group_by: t1int is ai, t1str is astr
        } -> {
          project: t1str, t1int
        }
      }
    `)
  );
  test(
    "second query doesn't have access to original fields",
    badModel(
      markSource`
        explore: aq is a {
          query: t1 is {
            group_by: t1int is ai, t1str is astr
          } -> {
            project: ${"ai"}
          }
        }
      `,
      "'ai' is not defined"
    )
  );
  test(
    "new query can append ops to existing query",
    modelOK(`
      explore: aq is a {
        query: t0 is {
          group_by: t1int is ai, t1str is astr
        }
        query: t1 is t0 -> {
          project: t1str, t1int
        }
      }
    `)
  );
  test(
    "new query can refine and append to exisiting query",
    modelOK(`
      explore: aq is table('aTable') {
        query: by_region is { group_by: astr }
        query: by_region2 is by_region {
          nest: dateNest is { group_by: ad }
        } -> {
          project: astr, dateNest.ad
        }
      }
    `)
  );
  test(
    "reference to a query can include a refinement",
    modelOK(`
      query: ab -> {
        group_by: ai
        nest: aturtle { limit: 1 }
      }
    `)
  );
  test(
    "Querying an explore based on a query",
    modelOK(`
      query: q is a -> { group_by: astr; aggregate: strsum is ai.sum() }
      explore: aq is a {
        join_one: aq is from(->q) on astr = aq.astr
      }
      query: aqf is aq -> { project: * }
    `)
  );
});

describe("standard sql function return types", () => {
  test("timestamp_seconds", () => {
    expect("timestamp_seconds(0)").toReturnType("timestamp");
  });
});
