/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Dialect} from '../../../dialect';
import {StructDef} from '../../../model';
import {HasParameter} from '../parameters/has-parameter';
import {FieldName, FieldSpace, QueryFieldSpace} from '../types/field-space';
import {LookupResult} from '../types/lookup-result';
import {SpaceEntry} from '../types/space-entry';
import {AbstractParameter} from '../types/space-param';

export class ParameterSpace implements FieldSpace {
  readonly type = 'fieldSpace';

  private readonly _map: Record<string, SpaceEntry>;
  constructor(parameters: HasParameter[]) {
    this._map = {};
    for (const parameter of parameters) {
      this._map[parameter.name] = new AbstractParameter(parameter);
    }
  }

  structDef(): StructDef {
    throw new Error('Parameter space does not have a structDef');
  }

  emptyStructDef(): StructDef {
    throw new Error('Parameter space does not have an emptyStructDef');
  }

  entry(name: string): SpaceEntry | undefined {
    return this._map[name];
  }

  lookup(symbol: FieldName[]): LookupResult {
    const name = symbol[0];
    if (name === undefined) {
      return {
        error: {
          message: 'Invalid reference',
          code: 'invalid-parameter-reference',
        },
        found: undefined,
      };
    }
    const entry = this.entry(name.refString);
    if (entry === undefined) {
      return {
        error: {
          message: `\`${name}\` is not defined`,
          code: 'parameter-not-found',
        },
        found: undefined,
      };
    }
    if (symbol.length > 1) {
      return {
        error: {
          message: `\`${name}\` cannot contain a \`${symbol
            .slice(1)
            .join('.')}\``,
          code: 'invalid-parameter-reference',
        },
        found: undefined,
      };
    }
    return {
      found: entry,
      error: undefined,
      joinPath: [],
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
