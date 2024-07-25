/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Dialect } from "../../../dialect";
import { Parameter, StructDef } from "../../../model";
import { HasParameter } from "../parameters/has-parameter";
import { FieldName, FieldSpace, QueryFieldSpace } from "../types/field-space";
import { LookupResult } from "../types/lookup-result";
import { SpaceEntry } from "../types/space-entry";
import { AbstractParameter, DefinedParameter } from "../types/space-param";

/**
 * Used to detect references to parent source's parameters when declaring a join
 */
export class ParameterSpace2 implements FieldSpace {
  readonly type = 'fieldSpace';
  private readonly _map: Record<string, SpaceEntry>;
  constructor(
    parameters: HasParameter[]
  ) {
    this._map = {};
    for (const parameter of parameters) {
      this._map[parameter.name] = new AbstractParameter(parameter);
    }
  }
  structDef(): StructDef {
    throw new Error("Parameter space does not have a structDef");
  }
  emptyStructDef(): StructDef {
    throw new Error("Parameter space does not have an emptyStructDef");
  }
  entry(name: string): SpaceEntry | undefined {
    return this._map[name];
  }
  lookup(symbol: FieldName[]): LookupResult {
    const name = symbol[0];
    if (name === undefined) {
      return {
        error: 'Invalid reference',
        found: undefined,
      };
    }
    const entry = this.entry(name.refString);
    if (entry === undefined) {
      return {
        error: `No parameter named \`${name}\``,
        found: undefined,
      };
    }
    if (symbol.length > 1) {
      return {
        error: `Parameter cannot contain a \`${symbol.slice(1).join(".")}\``,
        found: undefined,
      };
    }
    return {
      found: entry,
      error: undefined,
      relationship: [],
      isOutputField: false,
    };
  }
  entries(): [string, SpaceEntry][] {
    return Object.entries(this._map);
  }
  dialectObj(): Dialect | undefined {
    return undefined;
  }
  isQueryFieldSpace(): this is QueryFieldSpace {
    return false;
  }
}

/**
 * Used to detect references to parent source's parameters when declaring a join
 */
export class ParameterSpace implements FieldSpace {
  readonly type = 'fieldSpace';
  constructor(
    // This is the (dynamic) field space of the parent context where the parameters are being passed in;
    // for example, in a join `join_one: foo is foo(inner_param is outer_param)`, the
    // `parentSpace` is the field space in which `outer_param` is evaluated.
    readonly parentSpace: FieldSpace | undefined
  ) { }
  structDef(): StructDef {
    throw new Error("Parameter space does not have a structDef");
  }
  emptyStructDef(): StructDef {
    throw new Error("Parameter space does not have an emptyStructDef");
  }
  entry(name: string): SpaceEntry | undefined {
    if (this.parentSpace === undefined) return undefined;
    const result = this.parentSpace.entry(name);
    if (result === undefined) return undefined;
    if (result.refType === 'parameter') return result;
    return undefined;
  }
  lookup(symbol: FieldName[]): LookupResult {
    if (this.parentSpace === undefined) {
      return {
        error: 'No parent parameter space in which to lookup parameter values',
        found: undefined
      };
    }
    const name = symbol[0];
    if (name === undefined) {
      return {
        error: 'Invalid reference',
        found: undefined,
      };
    }
    const entry = this.entry(name.refString);
    if (entry === undefined) {
      return {
        error: `No parameter named \`${name}\` (options are ${this.entries()})`,
        found: undefined,
      };
    }
    if (symbol.length > 1) {
      return {
        error: `Parameter cannot contain a \`${symbol.slice(1).join(".")}\``,
        found: undefined,
      };
    }
    return {
      found: entry,
      error: undefined,
      relationship: [],
      isOutputField: false,
    };
  }
  entries(): [string, SpaceEntry][] {
    if (this.parentSpace === undefined) return [];
    return this.parentSpace.entries().filter(([n, e]) => e.refType === 'parameter');
  }
  dialectObj(): Dialect | undefined {
    return undefined;
  }
  isQueryFieldSpace(): this is QueryFieldSpace {
    return false;
  }
}