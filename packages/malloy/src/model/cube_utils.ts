/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {SourceDef} from './malloy_types';

// TODO handle joins...
export function resolveCubeSource(
  sources: SourceDef[],
  cubeUsage: string[][]
): SourceDef | undefined {
  overSources: for (const source of sources) {
    for (const usage of cubeUsage) {
      // TODO handle joins
      if (usage.length === 1) {
        if (
          source.fields.find(f => f.as ?? f.name === usage[0]) === undefined
        ) {
          continue overSources;
        }
      }
    }
    return source;
  }
}

export function formatCubeUsages(cubeUsages: string[][]) {
  return cubeUsages.map(cubeUsage => formatCubeUsage(cubeUsage)).join(', ');
}

export function formatCubeUsage(cubeUsage: string[]) {
  return `\`${cubeUsage.join('.')}\``;
}
