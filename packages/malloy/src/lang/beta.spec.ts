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

import { ExpressionDef } from "./ast";
import { StructSpace } from "./field-space";
import { TestTranslator, pretty } from "./jest-factories";

const inspectCompile = false;

/*
 * Thinking of these tests as just "do things parse", there should maybe
 * be additional tests for, "does the correct code get generated", but
 * the first step should be to write all the phrases in the grammar
 * and make sure they parse to ast and the ast generates something
 */

abstract class Testable {
  xlate: TestTranslator;
  constructor(x: TestTranslator) {
    this.xlate = x;
  }

  abstract compile(): void;

  hasErrors(): boolean {
    const t = this.xlate.translate();
    if (t.final && (t.errors === undefined || t.errors.length === 0)) {
      return false;
    }
    return true;
  }

  errReport(): string {
    const t = this.xlate.translate();
    if (t.errors) {
      return this.xlate.prettyErrors();
    }
    return "no errors to report";
  }
}

class BetaModel extends Testable {
  constructor(s: string) {
    super(new TestTranslator(s));
  }

  compile(): void {
    const compileTo = this.xlate.translate();
    if (compileTo.translated && inspectCompile) {
      console.log("MODEL: ", pretty(compileTo.translated.modelDef));
      console.log("QUERIES: ", pretty(compileTo.translated.queryList));
    }
    // All the stuff to ask the ast for a translation is already in TestTranslator
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toCompile(): R;
    }
  }
}

expect.extend({
  toCompile: function (x: Testable) {
    x.compile();
    if (x.hasErrors()) {
      return { message: () => x.errReport(), pass: false };
    }
    return { message: () => "No errors", pass: true };
  },
});

class BetaExpression extends Testable {
  constructor(src: string) {
    super(new TestTranslator(src, "malloyExpr"));
  }

  compile(): void {
    const exprAst = this.xlate.ast();
    if (exprAst instanceof ExpressionDef) {
      const aStruct = this.xlate.internalModel.contents.ab;
      if (aStruct.type === "struct") {
        const _exprDef = exprAst.getExpression(new StructSpace(aStruct));
      } else {
        throw new Error("Can't get simple namespace for expression tests");
      }
    } else if (this.hasErrors()) {
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
  test("explore table", modelOK(`explore: testA is table('aTable')`));
  test(
    "explore shorcut fitlered table",
    modelOK(`
      explore: testA is table('aTable') {? astring ~ 'a%' }
    `)
  );
  test(
    "explore fitlered table",
    modelOK(`
      explore: testA is table('aTable') { where: astring ~ 'a%' }
    `)
  );
  test("explore explore", modelOK(`explore: testA is a`));
  test(
    "explore query",
    modelOK(`explore: testA is from(a->{group_by: astring})`)
  );
  test(
    "refine explore",
    modelOK(`explore: aa is a { dimension: a is astring }`)
  );
  test(
    "anonymous query",
    modelOK("query: table('aTable') -> { group_by: astring }")
  );
  test(
    "query",
    modelOK("query: name is table('aTable') -> { group_by: astring }")
  );
  test(
    "query from query",
    modelOK(
      `
        query: q1 is ab->{ group_by: astring limit: 10 }
        query: q2 is ->q1
      `
    )
  );
  test(
    "query with refinements from query",
    modelOK(
      `
        query: q1 is ab->{ group_by: astring limit: 10 }
        query: q2 is ->q1 { aggregate: acount }
      `
    )
  );
  test(
    "chained query operations",
    modelOK(`
      query: ab
        -> { group_by: astring; aggregate: acount }
        -> { top: 5; where: astring ~ 'a%' group_by: astring }
    `)
  );
  test(
    "query from explore from query",
    modelOK(
      `query: from(ab -> {group_by: astring}) { dimension: bigstr is UPPER(astring) } -> { group_by: bigstr }`
    )
  );
  test(
    "query with shortcut filtered turtle",
    modelOK("query: allA is ab->aturtle {? astring ~ 'a%' }")
  );
  test(
    "query with filtered turtle",
    modelOK("query: allA is ab->aturtle { where: astring ~ 'a%' }")
  );
  test(
    "nest: in group_by:",
    modelOK(`
      query: ab -> {
        group_by: astring;
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

  test("undefined explore does not throw", () => {
    const m = new BetaModel("query: x->{ group_by: y }");
    expect(m).not.toCompile();
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
  test("single where", modelOK("explore: aa is a { where: aninteger > 10 }"));
  test(
    "multiple where",
    modelOK(`
      explore: aa is a {
        where: [
          aninteger > 10,
          afloat < 1000
        ]
      }
    `)
  );
  test("simple join", modelOK("explore: nab is a { join: b on astring }"));
  test("inverse join", modelOK("explore: nab is a { join: b on b.astring }"));
  test("is join", modelOK("explore: nab is a { join: nb is b on astring }"));
  test(
    "multiple joins",
    modelOK(`
      explore: nab is a {
        join: [
          b on astring,
          br is b on b.astring
        ]
      }
    `)
  );
  test("primary_key", modelOK("explore: c is a { primary_key: aninteger }"));
  test("rename", modelOK("explore: c is a { rename: anint is aninteger }"));
  test("accept single", modelOK("explore: c is a { accept: astring }"));
  test(
    "accept multi",
    modelOK("explore: c is a { accept: [ astring, afloat ] }")
  );
  test("except single", modelOK("explore: c is a { except: astring }"));
  test(
    "except multi",
    modelOK("explore: c is a { except: [ astring, afloat ] }")
  );
  test(
    "explore-query",
    modelOK("explore: c is a {query: q is { group_by: astring }}")
  );
  test(
    "refined explore-query",
    modelOK(`
      explore: abNew is ab {
        query: for1 is aturtle {? aninteger = 1 }
      }
    `)
  );
  test(
    "chained explore-query",
    modelOK(`
      explore: c is a {
        query: chain is {
          group_by: astring
        } -> {
          top: 10; order_by: astring
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
          q1 is { group_by: astring },
          q2 is { group_by: aninteger }
        ]
      }
    `)
  );
});

describe("qops", () => {
  test("group by single", modelOK("query: a->{ group_by: astring }"));
  test(
    "group by multiple",
    modelOK("query: a->{ group_by: [astring,aninteger] }")
  );
  test("aggregate single", modelOK("query: a->{ aggregate: num is count() }"));
  test(
    "aggregate multiple",
    modelOK(`
      query: a->{
        aggregate: [ num is count(), total is sum(aninteger) ]
      }
    `)
  );
  test("project ref", modelOK("query:ab->{ project: b.astring }"));
  test("project *", modelOK("query:ab->{ project: * }"));
  test("project def", modelOK("query:ab->{ project: one is 1 }"));
  test(
    "project multiple",
    modelOK(`
      query: a->{
        project: [ one is 1, astring ]
      }
    `)
  );
  test("index single", modelOK("query:a->{index: astring}"));
  test("index multiple", modelOK("query:a->{index: [astring,afloat]}"));
  test("index star", modelOK("query:a->{index: *}"));
  test("index by", modelOK("query:a->{index: * by aninteger}"));
  test("top N", modelOK("query: a->{ top: 5; group_by: astring }"));
  test(
    "top N by field",
    modelOK("query: a->{top: 5 by afloat; group_by: astring}")
  );
  test(
    "top N by expression",
    modelOK("query: ab->{top: 5 by acount; group_by: astring}")
  );
  test("limit N", modelOK("query: a->{ limit: 5; group_by: astring }"));
  test(
    "order by",
    modelOK("query: a->{ order_by: afloat; group_by: astring }")
  );
  test(
    "order by asc",
    modelOK("query: a->{ order_by: afloat asc; group_by: astring }")
  );
  test(
    "order by desc",
    modelOK("query: a->{ order_by: afloat desc; group_by: astring }")
  );
  test(
    "order by N",
    modelOK("query: a->{ order_by: 1 asc; group_by: astring }")
  );
  test(
    "order by multiple",
    modelOK(`
      query: a->{
        order_by: [1 asc, afloat desc]
        group_by: [ astring, afloat ]
      }
    `)
  );
  test(
    "where single",
    modelOK("query:a->{ group_by: astring; where: afloat > 10 }")
  );
  test(
    "having single",
    modelOK(
      "query:ab->{ aggregate: acount; group_by: astring; having: acount > 10 }"
    )
  );
  test(
    "where multiple",
    modelOK("query:a->{ group_by: astring; where: [afloat > 10,astring~'a%'] }")
  );
  test(
    "nest single",
    modelOK(`
      query: a->{
        group_by: aninteger
        nest: nestbystr is { group_by: astring; aggregate: N is count() }
      }
    `)
  );
  test(
    "nest multiple",
    modelOK(`
      query: a->{
        group_by: aninteger
        nest: [
          nestbystr is { group_by: astring; aggregate: N is count() },
          renest is { group_by: astring; aggregate: N is count() }
        ]
      }
    `)
  );
  test("nest ref", modelOK("query: ab->{group_by: aninteger; nest: aturtle}"));
});

describe("expressions", () => {
  describe("literals", () => {
    test("integer", exprOK("42"));
    test("string", exprOK(`'fortywo-two'`));
    test("string with quotes", exprOK(`'Isn'''t this nice'`));
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
        test(`timestamp truncate ${unit}`, exprOK(`atimestamp.${unit}`));
      }
    });

    describe("timestamp extraction", () => {
      for (const unit of timeframes) {
        // TODO expect these to error ...
        test(`timestamp extract ${unit}`, exprOK(`${unit}(atimestamp)`));
      }
    });
  });

  test("field name", exprOK("astring"));
  test("function call", exprOK("CURRENT_TIMESTAMP()"));

  describe("operators", () => {
    test("addition", exprOK("42 + 7"));
    test("subtraction", exprOK("42 - 7"));
    test("multiplication", exprOK("42 * 7"));
    test("division", exprOK("42 / 7"));
    test("unary negation", exprOK("- aninteger"));
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

  test("filtered measure", exprOK("acount {? astring = 'why?' }"));
  describe("aggregate forms", () => {
    test("count", exprOK("count()"));
    test("count distinct", exprOK("count(distinct astring)"));
    test("join.count()", exprOK("b.count()"));
    for (const f of ["sum", "min", "max", "avg"]) {
      const fOfT = `${f}(afloat)`;
      test(fOfT, exprOK(fOfT));
      if (f !== "min" && f !== "max") {
        const joinDot = `b.afloat.${f}()`;
        test(joinDot, exprOK(joinDot));
        const joinAgg = `b.${f}(afloat)`;
        test(joinAgg, exprOK(joinAgg));
      }
    }
  });

  describe("pick statements", () => {
    test(
      "full",
      exprOK(`
        pick 'the answer' when aninteger = 42
        pick 'the questionable answer' when aninteger = 54
        else 'random'
    `)
    );
    test(
      "applied",
      exprOK(`
        astring: pick 'the answer' when '42'
        pick 'the questionable answer' '54'
        else 'random'
    `)
    );
    test(
      "filtering",
      exprOK(`
        astring: pick 'missing value' when NULL
    `)
    );
    test(
      "tiering",
      exprOK(`
      aninteger:
        pick 1 when < 10
        pick 10 when < 100
        pick 100 when < 1000
        else 10000
  `)
    );
    test(
      "transforming",
      exprOK(`
        aninteger:
          pick "small" when < 10
          pick "medium" when < 100
          else "large"
    `)
    );
  });
});
