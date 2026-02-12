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

import type {Dialect} from '../../../dialect/dialect';
import {getDialect} from '../../../dialect/dialect_map';
import type {
  FieldDef,
  StructDef,
  SourceDef,
  JoinFieldDef,
  AccessModifierLabel,
} from '../../../model/malloy_types';
import {isJoined, isTurtle, isSourceDef} from '../../../model/malloy_types';

import type {SpaceEntry} from '../types/space-entry';
import type {LookupResult} from '../types/lookup-result';
import type {
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
  protected fromStruct: StructDef;

  constructor(
    struct: StructDef,
    protected readonly structDialect: string,
    protected readonly structConnection: string
  ) {
    this.fromStruct = struct;
  }

  dialectName(): string {
    return this.structDialect;
  }

  connectionName(): string {
    return this.structConnection;
  }

  dialectObj(): Dialect | undefined {
    try {
      return getDialect(this.structDialect);
    } catch {
      return undefined;
    }
  }

  defToSpaceField(from: FieldDef): SpaceField {
    if (isJoined(from)) {
      return new StructSpaceField(
        from,
        this.structDialect,
        this.structConnection
      );
    } else if (isTurtle(from)) {
      return new IRViewField(this, from);
    }
    return new ColumnSpaceField(from);
  }

  private get map(): FieldMap {
    if (this.memoMap === undefined) {
      this.memoMap = Object.create(null) as FieldMap;
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

  accessProtectionLevel(): AccessModifierLabel {
    return 'internal';
  }

  protected dropEntries(): void {
    this.memoMap = Object.create(null) as FieldMap;
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
      ret.parameters = Object.create(null);
    }
    ret.fields = [];
    return ret;
  }

  lookup(path: FieldName[], accessLevel?: AccessModifierLabel): LookupResult {
    accessLevel ??= this.accessProtectionLevel();
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
          // which wasn't known to be a join when the fieldspace was constructed.
          // TODO don't make one of these every time you do a lookup
          found = new StructSpaceField(
            definition,
            this.structDialect,
            this.structConnection
          );
        }
        // cswenson review todo I don't know how to count the reference properly now
        // i tried only writing it as a join reference if there was more in the path
        // but that failed because lookup([JOINNAME]) is called when translating JOINNAME.AGGREGATE(...)
        // with a 1-length-path but that IS a join reference and there is a test
        head.addReference({
          type:
            found instanceof StructSpaceFieldBase
              ? 'joinReference'
              : 'fieldReference',
          definition: {
            type: definition.type,
            annotation: definition.annotation,
            location: definition.location,
          },
          location: head.location,
          text: head.refString,
        });
      }
      if (definition?.accessModifier) {
        if (!accessAllowed(accessLevel, definition.accessModifier)) {
          return {
            error: {
              message: `'${head}' is ${definition?.accessModifier}`,
              code: 'field-not-accessible',
            },
            found: undefined,
          };
        }
      }
    } // cswenson review todo { else this is SpaceEntry not a field which can only be a param and what is going on? }
    const joinPath =
      found instanceof StructSpaceFieldBase
        ? [{...found.joinPathElement, name: head.refString}]
        : [];
    if (rest.length) {
      if (found instanceof StructSpaceFieldBase) {
        const restResult = found.fieldSpace.lookup(
          rest,
          lessPermissiveAccessLevel(
            accessLevel,
            found.fieldSpace.accessProtectionLevel()
          )
        );
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
  constructor(
    def: JoinFieldDef,
    private forDialect: string,
    private forConnection: string
  ) {
    super(def);
  }

  get fieldSpace(): FieldSpace {
    if (isSourceDef(this.structDef)) {
      return new StaticSourceSpace(this.structDef, 'internal');
    } else {
      return new StaticSpace(
        this.structDef,
        this.forDialect,
        this.forConnection
      );
    }
  }
}

export class StaticSourceSpace extends StaticSpace implements SourceFieldSpace {
  constructor(
    protected source: SourceDef,
    public readonly _accessProtectionLevel: AccessModifierLabel
  ) {
    super(source, source.dialect, source.connection);
  }
  structDef(): SourceDef {
    return this.source;
  }
  emptyStructDef(): SourceDef {
    const ret = {...this.source};
    ret.parameters = Object.create(null);
    ret.fields = [];
    return ret;
  }

  accessProtectionLevel(): AccessModifierLabel {
    return this._accessProtectionLevel;
  }
}

function accessAllowed(
  accessLevel: AccessModifierLabel,
  accessModifier: AccessModifierLabel
): boolean {
  if (accessModifier === 'public') return true;
  if (accessLevel === 'internal') return accessModifier === 'internal';
  if (accessLevel === 'private') return true;
  return false;
}

function lessPermissiveAccessLevel(
  a: AccessModifierLabel,
  b: AccessModifierLabel
): AccessModifierLabel {
  if (a === 'public' || b === 'public') return 'public';
  if (a === 'internal' || b === 'internal') return 'internal';
  return 'private';
}
