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
import { FieldSpace } from "./field-space";
import { TestTranslator } from "./jest-factories";

abstract class Testable {
  xlate: TestTranslator;
  constructor(x: TestTranslator) {
    this.xlate = x;
  }

  abstract compile(): void;

  hasErrors(): boolean {
    const t = this.xlate.translate();
    if (t.final) {
      if (t.errors) {
        return false;
      }
      return true;
    }
    return false;
  }

  errReport(): string {
    const t = this.xlate.translate();
    if (t.errors) {
      return this.xlate.prettyErrors();
    }
    return "";
  }
}

class BetaModel extends Testable {
  constructor(s: string) {
    super(new TestTranslator(s));
  }

  compile(): void {
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

function model(s: string): Testable {
  return new BetaModel(s);
}

class BetaExpression extends Testable {
  constructor(src: string) {
    super(new TestTranslator(src, "fieldExpr"));
  }

  compile(): void {
    const exprAst = this.xlate.ast();
    if (exprAst instanceof ExpressionDef) {
      const aStruct = this.xlate.internalModel.contents.a;
      if (aStruct.type === "struct") {
        const _exprDef = exprAst.getExpression(new FieldSpace(aStruct));
      } else {
        throw new Error("Can't get simple namespace for expression tests");
      }
    } else {
      throw new Error("Not an expression");
    }
  }
}

function expression(s: string): Testable {
  return new BetaExpression(s);
}

describe("top level explore definition tests", () => {
  test("define one explore", () => {
    const tModel = model(`explore: testA is 'aTable`);
    expect(tModel).toCompile();
  });
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
    test("integer", () => {
      const tExpr = expression("42");
      expect(tExpr).toCompile();
    });

    test("string", () => {
      const tExpr = expression(`'forty-two'`);
      expect(tExpr).toCompile();
    });
  });

  describe("timestamp truncation", () => {
    for (const unit of timeframes) {
      test(`timestamp truncate ${unit}`, () => {
        const tExpr = expression(`atimestamp.${unit}`);
        expect(tExpr).toCompile();
      });
    }
  });

  describe("timestamp extraction", () => {
    for (const unit of timeframes) {
      test(`timestamp truncate ${unit}`, () => {
        // TODO expect these to error ...
        const tExpr = expression(`${unit}(zzz_atimestamp)`);
        expect(tExpr).toCompile();
      });
    }
  });
});
