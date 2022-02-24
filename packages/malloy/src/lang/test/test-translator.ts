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

import { inspect } from "util";
import {
  StructDef,
  NamedModelObject,
  ModelDef,
  Query,
  QueryFieldDef,
  FieldDef,
  isFilteredAliasedName,
  PipeSegment,
  TurtleDef,
  DocumentLocation,
} from "../../model/malloy_types";
import { MalloyElement, ModelEntry, NameSpace } from "../ast";
import { MalloyTranslator, TranslateResponse } from "../parse-malloy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export function pretty(thing: any): string {
  return inspect(thing, { breakLength: 72, depth: Infinity });
}

export const aTableDef: StructDef = {
  type: "struct",
  name: "aTable",
  dialect: "standardsql",
  structSource: { type: "table" },
  structRelationship: { type: "basetable", connectionName: "test" },
  fields: [
    { type: "string", name: "astr" },
    { type: "number", name: "af", numberType: "float" },
    { type: "number", name: "ai", numberType: "integer" },
    { type: "date", name: "ad" },
    { type: "boolean", name: "abool" },
    { type: "timestamp", name: "ats" },
  ],
};

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
    const struct = this.modelDef.contents[name];
    if (struct.type == "struct") {
      const exported = this.modelDef.exports.includes(name);
      return { entry: struct, exported };
    }
  }

  setEntry(_name: string, _val: ModelEntry): void {
    throw new Error("Can't add entries to test model def");
  }
}

const testURI = "internal://test/root";
export class TestTranslator extends MalloyTranslator {
  testRoot?: TestRoot;
  /*
   * Tests can assume this model exists:
   *   explore: a is table('aTable') { primary_key: astr }
   *   explore: b is a
   *   explore: ab is a {
   *     join_one: b with astr
   *     measure: acount is count()
   *     query: aturtle is { group_bY: astr; aggregate: acount }
   *   }
   */
  internalModel: ModelDef = {
    name: testURI,
    exports: [],
    contents: {
      a: { ...aTableDef, primaryKey: "astr", as: "a" },
      b: { ...aTableDef, primaryKey: "astr", as: "b" },
      ab: {
        ...aTableDef,
        as: "ab",
        primaryKey: "astr",
        fields: [
          ...aTableDef.fields,
          {
            ...aTableDef,
            as: "b",
            structRelationship: {
              type: "one",
              onExpression: [
                { type: "field", path: "astr" },
                "=",
                { type: "field", path: "b.astr" },
              ],
            },
          },
          {
            type: "number",
            name: "acount",
            numberType: "integer",
            aggregate: true,
            e: ["COUNT()"],
            source: "count()",
          },
          {
            type: "turtle",
            name: "aturtle",
            pipeline: [
              {
                type: "reduce",
                fields: ["astr", "acount"],
              },
            ],
          },
        ],
      },
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
    const astAsk = this.astStep.step(this);
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
          at: this.defaultLocation(),
          message: `Missing imports: ${whatImports.join(",")}`,
        });
      }
      const needThese = this.schemaZone.getUndefined();
      if (needThese) {
        mysterious = false;
        this.logger.log({
          at: this.defaultLocation(),
          message: `Missing schema: ${needThese.join(",")}`,
        });
      }
      if (mysterious) {
        this.logger.log({
          at: this.defaultLocation(),
          message: "mysterious translation failure",
        });
      }
    }
  }

  get nameSpace(): Record<string, NamedModelObject> {
    const gotModel = this.translate();
    return gotModel?.translated?.modelDef.contents || {};
  }

  exploreFor(exploreName: string): StructDef {
    const explore = this.nameSpace[exploreName];
    if (explore && explore.type === "struct") {
      return explore;
    }
    throw new Error(`Expected model to contain explore '${exploreName}'`);
  }
}

export function getExplore(modelDef: ModelDef, name: string): StructDef {
  return modelDef.contents[name] as StructDef;
}

export function getModelQuery(modelDef: ModelDef, name: string): Query {
  return modelDef.contents[name] as Query;
}

export function getField(
  thing: StructDef | PipeSegment,
  name: string
): FieldDef {
  const result = thing.fields.find(
    (field: QueryFieldDef) =>
      typeof field !== "string" && (field.as || field.name) === name
  );
  if (typeof result === "string") {
    throw new Error("Expected a def, got a ref.");
  }
  if (result === undefined) {
    throw new Error("Expected a field, not undefined");
  }
  if (isFilteredAliasedName(result)) {
    throw new Error("Ignoring these for now");
  }
  return result;
}

// TODO "as" is almost always a code smell ...
export function getQueryField(structDef: StructDef, name: string): TurtleDef {
  return getField(structDef, name) as TurtleDef;
}

// TODO "as" is almost always a code smell ...
export function getJoinField(structDef: StructDef, name: string): StructDef {
  return getField(structDef, name) as StructDef;
}

export interface MarkedSource {
  code: string;
  locations: DocumentLocation[];
}

export function markSource(
  unmarked: TemplateStringsArray,
  ...marked: string[]
): MarkedSource {
  let code = "";
  const locations: DocumentLocation[] = [];
  for (let index = 0; index < marked.length; index++) {
    const mark = marked[index];
    code += unmarked[index];
    const lines = code.split("\n");
    const start = {
      line: lines.length - 1,
      character: lines[lines.length - 1].length,
    };
    const bitLines = mark.split("\n");
    const location = {
      url: "internal://test/root",
      range: {
        start,
        end: {
          line: start.line + bitLines.length - 1,
          character:
            bitLines.length === 1 ? start.character + mark.length : mark.length,
        },
      },
    };
    locations.push(location);
    code += mark;
  }
  code += unmarked[marked.length];
  return { code, locations };
}
