/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {Dialect} from '../../../dialect';
import {FunctionDef} from '../../../model';
import {ModelEntry} from './model-entry';
import {NameSpace} from './name-space';

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
            dialect: {
              [dialect.name]: {
                e: overload.e,
                supportsOrderBy: overload.supportsOrderBy,
                defaultOrderByArgIndex: overload.defaultOrderByArgIndex,
                supportsLimit: overload.supportsLimit,
              },
            },
            needsWindowOrderBy: overload.needsWindowOrderBy,
            between: overload.between,
            isSymmetric: overload.isSymmetric,
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
