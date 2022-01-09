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
import { TestTranslator } from "./jest-factories";

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
    const _compileTo = this.xlate.translate();
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
      const aStruct = this.xlate.internalModel.contents.a;
      if (aStruct.type === "struct") {
        const _exprDef = exprAst.getExpression(new StructSpace(aStruct));
      } else {
        throw new Error("Can't get simple namespace for expression tests");
      }
    } else {
      throw new Error("Not an expression");
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

describe("top level explore definition tests", () => {
  test("define one explore", modelOK(`explore: testA is table('aTable')`));
});

describe("expressions", () => {
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

  describe("literals", () => {
    test("integer", exprOK("42"));
    test("string", exprOK(`'fortywo-two'`));
  });

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
