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

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { inspect } from "util";
import { cloneDeep } from "lodash";
import {
  Expr,
  FieldDef,
  StructRef,
  FilterExpression,
  StructDef,
  Query,
  AtomicFieldType,
  NamedMalloyObject,
  ModelDef,
} from "../model/malloy_types";
import * as ast from "./ast";
import { compressExpr, MalloyElement, ModelEntry, NameSpace } from "./ast";
import { FieldSpace } from "./field-space";
import { MalloyTranslator, TranslateResponse } from "./parse-malloy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export function pretty(thing: any): string {
  return inspect(thing, { breakLength: 72, depth: Infinity });
}

export function mkFieldRefs(...names: string[]): ast.FieldReferences {
  return new ast.FieldReferences(names.map((str) => new ast.FieldName(str)));
}

export function mkFieldName(s: string) {
  return new ast.FieldName(s);
}
export function mkExprIdRef(s: string) {
  return new ast.ExprIdReference(s);
}
export function mkFieldDef(expr: string) {
  return new ast.ExpressionFieldDef(mkExprIdRef(expr), mkFieldName("test"));
}
export const aExpr = mkExprIdRef("a");
export function mkExprStringDef(str: string) {
  return new ast.ExpressionFieldDef(
    new ast.ExprString(str),
    mkFieldName("test")
  );
}
export const caFilter = new ast.Filter([
  new ast.FilterElement(
    new ast.Apply(mkExprIdRef("state"), new ast.ExprString("'ca'")),
    "state:'ca'"
  ),
]);

export function mkExploreOf(
  name: string,
  init: ast.ExploreInterface = {}
): ast.Explore {
  return testAST(new ast.Explore(new ast.NamedSource(name), init));
}

export const aTableDef: StructDef = {
  type: "struct",
  name: "aTable",
  dialect: "standardsql",
  structSource: { type: "table" },
  structRelationship: { type: "basetable", connectionName: "test" },
  fields: [
    { type: "string", name: "astring" },
    { type: "number", name: "afloat", numberType: "float" },
    { type: "number", name: "aninteger", numberType: "integer" },
    { type: "date", name: "adate" },
    { type: "timestamp", name: "atimestamp" },
  ],
};

export function mkStruct(name: string, primaryKey = "astring"): StructDef {
  return {
    ...cloneDeep(aTableDef),
    primaryKey: primaryKey,
    as: name,
  };
}

export function mkQuery(struct: StructRef): Query {
  return {
    type: "query",
    structRef: cloneDeep(struct),
    pipeline: [],
    filterList: [],
  };
}

export function mkFilters(...pairs: string[]): FilterExpression[] {
  const filters: FilterExpression[] = [];
  let i = 0;
  while (i <= pairs.length - 2) {
    const thing = pairs[i];
    const thingIs = `'${pairs[i + 1]}'`;
    const exprSrc = `${thing}:${thingIs}`;
    const expr = new ast.Apply(mkExprIdRef(thing), new ast.ExprString(thingIs));
    const fs = new FieldSpace(aTableDef);
    filters.push({
      expression: compressExpr(expr.getExpression(fs).value),
      source: exprSrc,
    });
    i += 2;
  }
  return filters;
}

export function mkJoin(
  struct: StructDef,
  joinName: string,
  on: string
): StructDef {
  return {
    ...cloneDeep(struct),
    as: joinName,
    structRelationship: { type: "foreignKey", foreignKey: on },
  };
}

export function mkCountDef(name: string, source?: string): FieldDef {
  const f: FieldDef = {
    name: name,
    type: "number",
    aggregate: true,
    e: [{ type: "aggregate", function: "count", e: [] }],
  };
  if (source) {
    f.source = source;
  }
  return f;
}

export function mkAgg(
  func: string,
  name: string,
  e: Expr,
  t: AtomicFieldType = "number"
): FieldDef {
  const ret: FieldDef = {
    name: name,
    type: t,
    aggregate: true,
    e: [{ type: "aggregate", function: func, e: e }],
  };
  return ret;
}

export function testAST<T extends MalloyElement>(astNode: T): T {
  return astNode;
}

/**
 * When translating partial trees, there will not be a document node
 * to handle namespace requests, this stands in for document in that case.
 */
class TestRoot extends MalloyElement implements NameSpace {
  elementType = "test root";

  constructor(
    child: MalloyElement,
    forTranslator: MalloyTranslator,
    private modelDef: ModelDef
  ) {
    super({ child });
    this.setTranslator(forTranslator);
  }

  namespace(): NameSpace {
    return this;
  }

  getEntry(name: string): ModelEntry | undefined {
    const struct = this.modelDef.structs[name];
    if (struct.type == "struct") {
      const exported = this.modelDef.exports.includes(name);
      return { struct, exported };
    }
  }

  setEntry(_name: string, _val: ModelEntry): void {
    throw new Error("Can't add entries to test model def");
  }
}

const testURI = "internal://test/root";
export class TestTranslator extends MalloyTranslator {
  testRoot?: TestRoot;
  internalModel: ModelDef = {
    name: testURI,
    exports: [],
    structs: {
      a: { ...aTableDef, primaryKey: "astring", as: "a" },
      b: { ...aTableDef, primaryKey: "astring", as: "b" },
    },
  };

  constructor(source: string, rootRule = "malloyDocument") {
    super(testURI);
    this.grammarRule = rootRule;
    this.importZone.define("internal://test/root", source);
    this.schemaZone.define("aTable", aTableDef);
  }

  translate(): TranslateResponse {
    return super.translate(this.internalModel);
  }

  ast(): MalloyElement | undefined {
    const astAsk = this.getASTResponse();
    if (astAsk.ast) {
      if (this.grammarRule !== "malloyDocument") {
        this.testRoot = new TestRoot(astAsk.ast, this, this.internalModel);
      }
      return astAsk.ast;
    }
    this.explainFailure();
  }

  private explainFailure() {
    let mysterious = true;
    if (this.logger.empty()) {
      const whatImports = this.importZone.getUndefined();
      if (whatImports) {
        mysterious = false;
        this.logger.log({
          sourceURL: "test://",
          message: `Missing imports: ${whatImports.join(",")}`,
        });
      }
      const needThese = this.schemaZone.getUndefined();
      if (needThese) {
        mysterious = false;
        this.logger.log({
          sourceURL: "test://",
          message: `Missing schema: ${needThese.join(",")}`,
        });
      }
      if (mysterious) {
        this.logger.log({
          sourceURL: "test://",
          message: "mysterious translation failure",
        });
      }
    }
  }

  get nameSpace(): Record<string, NamedMalloyObject> {
    const gotModel = this.translate();
    return gotModel?.translated?.modelDef.structs || {};
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
// export async function exploreFor(src: string) {
//   const parse = new TestTranslator(src, "explore");
//   const req = parse.translate();
//   if (req.tables) {
//     const tables = await Malloy.db.getSchemaForMissingTables(req.tables);
//     parse.update({ tables });
//   }
//   const explore = parse.ast() as ast.Explore;
//   return {
//     schema: parse.schemaZone,
//     explore,
//     errors: parse.logger.getLog(),
//     errorFree: parse.logger.noErrors(),
//   };
// }
