/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Dialect} from '../../../dialect';
import type {FunctionDef} from '../../../model';
import type {ModelEntry} from './model-entry';
import type {NameSpace} from './name-space';

/**
 * This is the dialect namespace, which sits below the global namespace.
 */
export class DialectNameSpace implements NameSpace {
  private entries: Map<string, FunctionDef> = new Map();
  constructor(dialect: Dialect) {
    const dialectFunctions = dialect.getDialectFunctions();
    for (const name in dialectFunctions) {
      const overloads = dialectFunctions[name];
      this.entries.set(name, {
        type: 'function',
        name,
        overloads: overloads.map(overload => {
          return {
            returnType: overload.returnType,
            params: overload.params,
            supportsOrderBy: overload.supportsOrderBy,
            supportsLimit: overload.supportsLimit,
            isSymmetric: overload.isSymmetric,
            genericTypes: overload.genericTypes,
            dialect: {
              [dialect.name]: {
                e: overload.e,
                defaultOrderByArgIndex: overload.defaultOrderByArgIndex,
                between: overload.between,
                needsWindowOrderBy: overload.needsWindowOrderBy,
              },
            },
          };
        }),
      });
    }
  }

  getEntry(name: string): ModelEntry | undefined {
    const func = this.entries.get(name);
    if (func === undefined) {
      return undefined;
    }
    return {
      entry: func,
      exported: false,
    };
  }

  setEntry(_name: string, _value: ModelEntry, _exported: boolean): void {
    throw new Error('The dialect namespace is immutable!');
  }
}
