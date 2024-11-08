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

import {Dialect} from '../../../dialect/dialect';
import {getDialect} from '../../../dialect/dialect_map';
import {
  FieldDef,
  StructDef,
  SourceDef,
  isJoined,
  isTurtleDef,
  isSourceDef,
  JoinFieldDef,
} from '../../../model/malloy_types';

import {SpaceEntry} from '../types/space-entry';
import {LookupResult} from '../types/lookup-result';
import {
  FieldName,
  FieldSpace,
  QueryFieldSpace,
  SourceFieldSpace,
} from '../types/field-space';
import {DefinedParameter} from '../types/space-param';
import {SpaceField} from '../types/space-field';
import {StructSpaceFieldBase} from './struct-space-field-base';
import {ColumnSpaceField} from './column-space-field';
import {IRViewField} from './ir-view-field';

type FieldMap = Record<string, SpaceEntry>;

export class StaticSpace implements FieldSpace {
  readonly type = 'fieldSpace';
  private memoMap?: FieldMap;
  get dialect() {
    return this.fromStruct.dialect;
  }

  constructor(protected fromStruct: StructDef) {}

  dialectName(): string {
    return this.fromStruct.dialect;
  }

  dialectObj(): Dialect | undefined {
    try {
      return getDialect(this.fromStruct.dialect);
    } catch {
      return undefined;
    }
  }

  defToSpaceField(from: FieldDef): SpaceField {
    if (isJoined(from)) {
      return new StructSpaceField(from);
    } else if (isTurtleDef(from)) {
      return new IRViewField(this, from);
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
      if (isSourceDef(this.fromStruct)) {
        if (this.fromStruct.parameters) {
          for (const [paramName, paramDef] of Object.entries(
            this.fromStruct.parameters
          )) {
            if (!(paramName in this.memoMap)) {
              this.memoMap[paramName] = new DefinedParameter(paramDef);
            }
          }
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

  // TODO this was protected
  entry(name: string): SpaceEntry | undefined {
    return this.map[name];
  }

  protected setEntry(name: string, value: SpaceEntry): void {
    this.map[name] = value;
  }

  entries(): [string, SpaceEntry][] {
    return Object.entries(this.map);
  }

  structDef(): StructDef {
    return this.fromStruct;
  }

  emptyStructDef(): StructDef {
    const ret = {...this.fromStruct};
    if (isSourceDef(ret)) {
      ret.parameters = {};
    }
    ret.fields = [];
    return ret;
  }

  lookup(path: FieldName[]): LookupResult {
    const head = path[0];
    const rest = path.slice(1);
    let found = this.entry(head.refString);
    if (!found) {
      return {
        error: {
          message: `'${head}' is not defined`,
          code: 'field-not-found',
        },
        found,
      };
    }
    if (found instanceof SpaceField) {
      const definition = found.fieldDef();
      if (definition) {
        if (!(found instanceof StructSpaceFieldBase) && isJoined(definition)) {
          // We have looked up a field which is a join, but not a StructSpaceField
          // because it is someting like "dimension: joinedArray is arrayComputation"
          // so it is a FieldDefinitionValue.
          // TODO don't make one of these every time you do a lookup
          found = new StructSpaceField(definition);
        }
        head.addReference({
          type:
            found instanceof StructSpaceFieldBase && path.length > 1
              ? 'joinReference'
              : 'fieldReference',
          definition,
          location: head.location,
          text: head.refString,
        });
      }
    }
    const joinPath =
      found instanceof StructSpaceFieldBase
        ? [{...found.joinPathElement, name: head.refString}]
        : [];
    if (rest.length) {
      if (found instanceof StructSpaceFieldBase) {
        const restResult = found.fieldSpace.lookup(rest);
        if (restResult.found) {
          return {
            ...restResult,
            joinPath: [...joinPath, ...restResult.joinPath],
          };
        } else {
          return restResult;
        }
      }
      return {
        error: {
          message: `'${head}' cannot contain a '${rest[0]}'`,
          code: 'invalid-property-access-in-field-reference',
        },
        found: undefined,
      };
    }
    return {found, error: undefined, joinPath, isOutputField: false};
  }

  isQueryFieldSpace(): this is QueryFieldSpace {
    return false;
  }
}

export class StructSpaceField extends StructSpaceFieldBase {
  constructor(def: JoinFieldDef) {
    super(def);
  }

  get fieldSpace(): FieldSpace {
    return new StaticSpace(this.structDef);
  }
}

export class StaticSourceSpace extends StaticSpace implements SourceFieldSpace {
  constructor(protected source: SourceDef) {
    super(source);
  }
  structDef(): SourceDef {
    return this.source;
  }
  emptyStructDef(): SourceDef {
    const ret = {...this.source};
    ret.parameters = {};
    ret.fields = [];
    return ret;
  }
}
