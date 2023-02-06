/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { Dialect } from "../../../dialect/dialect";
import { getDialect } from "../../../dialect/dialect_map";
import { FieldDef, isTurtleDef, StructDef } from "../../../model/malloy_types";

import { SpaceEntry } from "../types/space-entry";
import { LookupResult } from "../types/lookup-result";
import { FieldName, FieldSpace } from "../types/field-space";
import { DefinedParameter } from "../types/space-param";
import { SpaceField } from "../types/space-field";
import { StructSpaceFieldBase } from "./struct-space-field-base";
import { ColumnSpaceField } from "./column-space-field";
import { QueryFieldStruct } from "./query-field-struct";

type FieldMap = Record<string, SpaceEntry>;

export class StaticSpace implements FieldSpace {
  readonly type = "fieldSpace";
  private memoMap?: FieldMap;
  protected fromStruct: StructDef;

  constructor(sourceStructDef: StructDef) {
    this.fromStruct = sourceStructDef;
  }

  whenComplete(step: () => void): void {
    step();
  }

  dialectObj(): Dialect | undefined {
    try {
      return getDialect(this.fromStruct.dialect);
    } catch {
      return undefined;
    }
  }

  defToSpaceField(from: FieldDef): SpaceField {
    if (from.type === "struct") {
      return new StructSpaceField(from);
    } else if (isTurtleDef(from)) {
      return new QueryFieldStruct(this, from);
    }
    return new ColumnSpaceField(from);
  }

  private get map(): FieldMap {
    if (this.memoMap === undefined) {
      this.memoMap = {};
      for (const f of this.fromStruct.fields) {
        const name = f.as || f.name;
        this.memoMap[name] = this.defToSpaceField(f);
      }
      if (this.fromStruct.parameters) {
        for (const [paramName, paramDef] of Object.entries(
          this.fromStruct.parameters
        )) {
          if (this.memoMap[paramName]) {
            throw new Error(
              `In struct '${this.fromStruct.as || this.fromStruct.name}': ` +
                ` : Field and parameter name conflict '${paramName}`
            );
          }
          this.memoMap[paramName] = new DefinedParameter(paramDef);
        }
      }
    }
    return this.memoMap;
  }

  protected dropEntries(): void {
    this.memoMap = {};
  }

  protected dropEntry(name: string): void {
    delete this.map[name];
  }

  protected entry(name: string): SpaceEntry | undefined {
    return this.map[name];
  }

  protected setEntry(name: string, value: SpaceEntry): void {
    this.map[name] = value;
  }

  protected entries(): [string, SpaceEntry][] {
    return Object.entries(this.map);
  }

  structDef(): StructDef {
    return this.fromStruct;
  }

  emptyStructDef(): StructDef {
    return { ...this.fromStruct, fields: [] };
  }

  lookup(path: FieldName[]): LookupResult {
    const head = path[0];
    const rest = path.slice(1);
    const found = this.entry(head.refString);
    if (!found) {
      return { error: `'${head}' is not defined`, found };
    }
    if (found instanceof SpaceField) {
      /*
       * TODO cache defs, post the addReference call to whenComplete
       *
       * In the cleanup phase of query space construction, it may check
       * the output space for ungrouping variables. However if an
       * ungrouping variable is a measure, the field expression value
       * needed to get the definition needs to be computed in the
       * input space of the query. There is a test which failed which
       * caused this code to be here, but this is really a bandaid.
       *
       * Some re-work of how to get the definition of a SpaceField
       * no matter what it is contained in needs to be thought out.
       *
       * ... or this check would look at the finalized output of
       * the namespace and not re-compile ...
       */
      const definition = found.fieldDef();
      if (definition) {
        head.addReference({
          type:
            found instanceof StructSpaceFieldBase
              ? "joinReference"
              : "fieldReference",
          definition,
          location: head.location,
          text: head.refString,
        });
      }
    }
    if (rest.length) {
      if (found instanceof StructSpaceFieldBase) {
        return found.fieldSpace.lookup(rest);
      }
      return {
        error: `'${head}' cannot contain a '${rest[0]}'`,
        found: undefined,
      };
    }
    return { found, error: undefined };
  }
}

export class StructSpaceField extends StructSpaceFieldBase {
  constructor(def: StructDef) {
    super(def);
  }

  get fieldSpace(): FieldSpace {
    return new StaticSpace(this.sourceDef);
  }
}
