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
    super(new TestTranslator(src, "fieldExpr"));
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

describe("top level definition", () => {
  test("explore", modelOK(`explore: testA is table('aTable')`));
  test(
    "anonymous query",
    modelOK("query: table('aTable') -> { group_by: astring }")
  );
  test(
    "query",
    modelOK("query: name is table('aTable') -> { group_by: astring }")
  );
  test(
    "query with filtered turtle",
    modelOK("query: allA is ab->aturtle {? astring ~ 'a%' }")
  );
  test(
    "refined turtle",
    modelOK(`
      explore: abNew is ab {
        query: for1 is aturtle {? aninteger = 1 }
      }
    `)
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
    expect(modelOK("query: x->{ group_by: y }")).not.toThrow(Error);
  });

  test(
    "query from explore from query",
    modelOK(
      `query: from(ab -> {group_by: astring}) { dimension: bigstr is UPPER(astring) } -> { group_by: bigstr }`
    )
  );
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
    test("count distinct", exprOK("count(distinct astring)"));
    test("count", exprOK("count()"));
    test("join.field.count()", exprOK("b.astring.count()"));
    for (const f of ["sum", "min", "max", "avg"]) {
      test(`${f}(afloat)`, exprOK(`${f}(afloat)`));
    }
    for (const f of ["sum", "min", "max", "avg"]) {
      test(`b.afloat.${f}()`, exprOK(`b.afloat.${f}()`));
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
