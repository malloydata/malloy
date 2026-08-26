/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Dialect} from '../../../dialect/dialect';
import {getDialect} from '../../../dialect/dialect_map';
import type {
  FieldDef,
  StructDef,
  SourceDef,
  JoinFieldDef,
  AccessModifierLabel,
  NonDefaultAccessModifierLabel,
} from '../../../model/malloy_types';
import {
  activeName,
  isJoined,
  isTurtle,
  isSourceDef,
  mkSafeRecord,
} from '../../../model/malloy_types';

import type {SpaceEntry} from '../types/space-entry';
import type {JoinPath, LookupError, LookupResult} from '../types/lookup-result';
import type {
  FieldName,
  FieldSpace,
  QueryFieldSpace,
  SourceFieldSpace,
} from '../types/field-space';
import {currentGeneration, noteRebinding} from '../types/field-space';
import {DefinedParameter} from '../types/space-param';
import {SpaceField} from '../types/space-field';
import {StructSpaceFieldBase} from './struct-space-field-base';
import {ColumnSpaceField} from './column-space-field';
import {IRViewField} from './ir-view-field';

export class StaticSpace implements FieldSpace {
  readonly type = 'fieldSpace';
  private memoMap?: Map<string, SpaceEntry>;
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

  private get map(): Map<string, SpaceEntry> {
    if (this.memoMap === undefined) {
      this.memoMap = new Map<string, SpaceEntry>();
      for (const f of this.fromStruct.fields) {
        const name = activeName(f);
        this.memoMap.set(name, this.defToSpaceField(f));
      }
      if (isSourceDef(this.fromStruct)) {
        if (this.fromStruct.parameters) {
          for (const [paramName, paramDef] of Object.entries(
            this.fromStruct.parameters
          )) {
            if (!this.memoMap.has(paramName)) {
              this.memoMap.set(paramName, new DefinedParameter(paramDef));
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

  /**
   * StaticSpace itself never rebinds anything after construction, but
   * DynamicSpace extends it and the three mutators below are the whole
   * write surface for both -- `memoMap` is private, and every caller
   * goes through these. That is what makes "every rebinding bumps the
   * generation" checkable rather than a hope.
   */
  generation(): number {
    return currentGeneration();
  }

  protected dropEntries(): void {
    noteRebinding();
    this.memoMap = new Map<string, SpaceEntry>();
  }

  protected dropEntry(name: string): void {
    noteRebinding();
    this.map.delete(name);
  }

  // TODO this was protected
  entry(name: string): SpaceEntry | undefined {
    return this.map.get(name);
  }

  protected setEntry(name: string, value: SpaceEntry): void {
    noteRebinding();
    this.map.set(name, value);
  }

  entries(): [string, SpaceEntry][] {
    return [...this.map.entries()];
  }

  structDef(): StructDef {
    return this.fromStruct;
  }

  emptyStructDef(): StructDef {
    const ret = {...this.fromStruct};
    if (isSourceDef(ret)) {
      ret.parameters = mkSafeRecord();
    }
    ret.fields = [];
    return ret;
  }

  lookup(path: FieldName[], accessLevel?: AccessModifierLabel): LookupResult {
    accessLevel ??= this.accessProtectionLevel();
    const last = path[path.length - 1];
    const ns = resolveNamespace(
      this,
      path.slice(0, -1),
      accessLevel,
      last.refString
    );
    if (ns.error) {
      return ns;
    }
    const read = readEntry(ns.space, last, ns.accessLevel);
    if (read.error) {
      return read;
    }
    const found = read.found;
    const joinPath =
      found instanceof StructSpaceFieldBase
        ? [...ns.joinPath, {...found.joinPathElement, name: last.refString}]
        : ns.joinPath;
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
    ret.parameters = {};
    ret.fields = [];
    return ret;
  }

  accessProtectionLevel(): AccessModifierLabel {
    return this._accessProtectionLevel;
  }
}

/**
 * A namespace reached by walking a join path, and the access level a reader
 * who started at `accessLevel` has once they arrive there.
 */
export interface NamespaceRead {
  space: FieldSpace;
  accessLevel: AccessModifierLabel;
  joinPath: JoinPath;
  error: undefined;
}

/**
 * Walk `path` from `from`, one `readEntry` per hop, narrowing the access
 * level at each join. `lookup()` walks the path before a name with it and
 * `*` walks the path before a star. `member` is what is about to be read from the namespace at the end
 * of the path, a field name or `'*'`, named in the error when a hop is not a
 * namespace.
 */
export function resolveNamespace(
  from: FieldSpace,
  path: FieldName[],
  accessLevel: AccessModifierLabel,
  member: string
): NamespaceRead | LookupError {
  let space = from;
  const joinPath: JoinPath = [];
  for (let i = 0; i < path.length; i++) {
    const hop = path[i];
    const read = readEntry(space, hop, accessLevel);
    if (read.error) {
      return read;
    }
    if (!(read.found instanceof StructSpaceFieldBase)) {
      const next = i + 1 < path.length ? path[i + 1].refString : member;
      const message =
        next === '*'
          ? `'${hop}' does not contain fields and cannot be expanded with '*'`
          : `'${hop}' cannot contain a '${next}'`;
      return {
        error: {
          message,
          code: 'invalid-property-access-in-field-reference',
          at: hop,
        },
        found: undefined,
      };
    }
    joinPath.push({...read.found.joinPathElement, name: hop.refString});
    space = read.found.fieldSpace;
    accessLevel = lessPermissiveAccessLevel(
      accessLevel,
      space.accessProtectionLevel()
    );
  }
  return {space, accessLevel, joinPath, error: undefined};
}

interface EntryRead {
  found: SpaceEntry;
  error: undefined;
}

/**
 * Read one name from a namespace on behalf of a reader at `accessLevel`.
 * Records the reference, and refuses the entry if the reader may not see it.
 */
export function readEntry(
  space: FieldSpace,
  name: FieldName,
  accessLevel: AccessModifierLabel
): EntryRead | LookupError {
  let found = space.entry(name.refString);
  let restriction: NonDefaultAccessModifierLabel | undefined;
  if (!found) {
    return {
      error: {
        message: `'${name}' is not defined`,
        code: 'field-not-found',
        at: name,
      },
      found: undefined,
    };
  }
  if (found instanceof SpaceField) {
    const definition = found.fieldDef();
    restriction = definition?.accessModifier;
    if (definition) {
      if (!(found instanceof StructSpaceFieldBase) && isJoined(definition)) {
        // A field which turned out to be a join after the space was built,
        // e.g. "dimension: joinedArray is arrayComputation", so the entry
        // is not a StructSpaceField; promote it so the path can continue.
        found = new StructSpaceField(
          definition,
          space.dialectName(),
          space.connectionName()
        );
      }
      // A one-element path to a join is still a join reference:
      // JOIN.aggregate() looks the join up on its own.
      name.addReference({
        type:
          found instanceof StructSpaceFieldBase
            ? 'joinReference'
            : 'fieldReference',
        definition: {
          type: definition.type,
          annotations: definition.annotations,
          location: definition.location,
        },
        location: name.location,
        text: name.refString,
      });
    }
  }
  if (restriction && !accessAllowed(accessLevel, restriction)) {
    return {
      error: {
        message: `'${name}' is ${restriction}`,
        code: 'field-not-accessible',
        at: name,
      },
      found: undefined,
    };
  }
  return {found, error: undefined};
}

/**
 * Every entry of `space` a reader at `accessLevel` may see, by the same
 * rule `readEntry` applies to one name.
 */
export function accessibleEntries(
  space: FieldSpace,
  accessLevel: AccessModifierLabel
): [string, SpaceEntry][] {
  return space.entries().filter(([, entry]) => {
    const restriction =
      entry instanceof SpaceField
        ? entry.fieldDef()?.accessModifier
        : undefined;
    return restriction === undefined || accessAllowed(accessLevel, restriction);
  });
}

function accessAllowed(
  accessLevel: AccessModifierLabel,
  accessModifier: NonDefaultAccessModifierLabel
): boolean {
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
