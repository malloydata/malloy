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

// Custom matchers for writing jest unit tests for the tranlsation code

import { diff as jestDiff } from "jest-diff";
import { MalloyElement } from "./ast";
import { MalloyTranslator } from "./parse-malloy";
import { TestTranslator, pretty } from "./jest-factories";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeErrorless(): R;
      toTranslate(): R;
      toBeValidMalloy(): R;
      toHaveExploreErrors(...errs: string[]): R;
      toEqualAst(result: MalloyElement): R;
      toMakeAst(astRoot: string, wantAst: MalloyElement): R;
      // toMakeQuery(query: Query): R;
    }
  }
}

// function fieldSort(a: FieldRef, b: FieldRef) {
//   const aName = typeof a === "string" ? a : a.as || a.name;
//   const bName = typeof b === "string" ? b : b.as || b.name;
//   return aName > bName ? 1 : aName < bName ? -1 : 0;
// }

// function sortFields(q: Query): Query {
//   const qr = q.structRef;
//   if (refIsStructDef(qr)) {
//     const sortedQ = { ...q };
//     if (refIsStructDef(sortedQ.structRef)) {
//       sortedQ.structRef.fields = qr.fields.sort(fieldSort);
//     }
//     return sortedQ;
//   }
//   return q;
// }

function checkForErrors(trans: MalloyTranslator) {
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

/**
 * Diff the readable "toString" dump of an AST to compare two ASTs
 * @param goodAst
 * @param checkAst
 * @returns MatchResult
 */
function compareAst(goodAst: MalloyElement, checkAst: MalloyElement) {
  const astGoalStr = goodAst.toString();
  const astStr = checkAst?.toString() || "";
  if (astGoalStr !== astStr) {
    const diffString = jestDiff(astGoalStr, astStr, {
      contextLines: 5,
      expand: false,
    });
    return {
      message: () => `AST did not match expectations: \n${diffString}`,
      pass: false,
    };
  }
  return {
    message: () => "AST matched",
    pass: true,
  };
}

expect.extend({
  toTranslate: function (trans: MalloyTranslator) {
    const xr = trans.translate();
    if (xr.errors) {
      return checkForErrors(trans);
    }
    if (xr.translated) {
      return { message: () => "Translation Succesful", pass: true };
    }
    return {
      message: () => `Translation failed, needs: ${pretty(xr)}`,
      pass: false,
    };
  },

  toBeErrorless: function (trans: MalloyTranslator) {
    return checkForErrors(trans);
  },

  toBeValidMalloy: function (src: string) {
    const x = new TestTranslator(src, "malloyDocument");
    x.ast();
    return checkForErrors(x);
  },

  toEqualAst: function (checkAst: MalloyElement, goodAst: MalloyElement) {
    return compareAst(goodAst, checkAst);
  },

  toMakeAst: function (
    source: string,
    astRule: string,
    goodAst: MalloyElement
  ) {
    const trans = new TestTranslator(source, astRule);
    expect(trans).toBeValidMalloy();
    const ast = trans.ast();
    expect(trans).toBeErrorless();
    expect(ast).toBeDefined();
    if (ast === undefined) {
      throw new Error(
        "jest and typescript need some time alone together to work things out"
      );
    }
    return compareAst(goodAst, ast);
  },

  toHaveExploreErrors: function (src: string, ...errs: string[]) {
    const x = new TestTranslator(src, "malloyDocument");
    expect(x).toBeValidMalloy();
    x.translate();
    if (x.logger.hasErrors()) {
      const missing: string[] = [];
      for (const expectedMsg of errs) {
        const hasError = x.logger
          .getLog()
          .find((m) => m.message.includes(expectedMsg));
        if (!hasError) {
          missing.push(expectedMsg);
        }
      }
      if (missing.length === 0) {
        return {
          pass: true,
          message: () => "All listed errors were matched",
        };
      }
      return {
        pass: false,
        message: () =>
          "The following expected errors were not matched\n    " +
          missing.join("\n .   "),
      };
    }
    return {
      pass: false,
      message: () => "Did not contain listed errors",
    };
  },

  // toMakeQuery: function (srcCode: string, goodQuery: Query) {
  //   const x = new TestTranslator(srcCode, "explore");
  //   const t = x.ast();
  //   expect(x).toBeErrorless();
  //   if (t instanceof Explore) {
  //     t.setTranslator(x);
  //     const query = t.query();
  //     expect(x).toBeErrorless();
  //     expect(query).toBeDefined();
  //     expect(sortFields(query)).toEqual(sortFields(goodQuery));
  //     return {
  //       message: () => "queries matched",
  //       pass: true,
  //     };
  //   }
  //   expect(t).toBeDefined();
  //   return {
  //     message: () => `Expected explore, got ${t?.toString()}`,
  //     pass: false,
  //   };
  // },
});

export default undefined;
