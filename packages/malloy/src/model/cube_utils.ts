/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {isNotUndefined} from '../lang/utils';
import {CubeUsage, SourceDef} from './malloy_types';

// TODO handle joins...
export function resolveCubeSources(
  sources: SourceDef[],
  cubeUsage: CubeUsage
): SourceDef | undefined {
  overSources: for (const source of sources) {
    for (const usage of cubeUsage.fields) {
      // TODO handle joins
      if (source.fields.find(f => f.as ?? f.name === usage) === undefined) {
        continue overSources;
      }
    }
    return source;
  }
}

export function cubeUsagePaths(cubeUsage: CubeUsage): string[][] {
  return [
    ...cubeUsage.fields.map(f => [f]),
    ...Object.entries(cubeUsage.joinedUsage)
      .map(([joinName, joinedUsage]) =>
        cubeUsagePaths(joinedUsage).map(path => [joinName, ...path])
      )
      .flat(),
  ];
}

export function formatCubeUsages(cubeUsage: CubeUsage) {
  return cubeUsagePaths(cubeUsage)
    .map(cubeUsage => formatCubeUsage(cubeUsage))
    .join(', ');
}

function countCubeUsage(cubeUsage: CubeUsage): number {
  return Object.values(cubeUsage.joinedUsage).reduce(
    (a, b) => a + countCubeUsage(b),
    cubeUsage.fields.length
  );
}

export function cubeUsageIsPlural(cubeUsage: CubeUsage): boolean {
  return countCubeUsage(cubeUsage) > 1;
}

export function formatCubeUsage(cubeUsage: string[]) {
  return `\`${cubeUsage.join('.')}\``;
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function mergeCubeUsage(...usages: CubeUsage[]): CubeUsage {
  const joinNames = new Set(usages.map(u => Object.keys(u.joinedUsage)).flat());
  const joinedUsage = {};
  for (const joinName of joinNames) {
    joinedUsage[joinName] = mergeCubeUsage(
      ...usages.map(u => u.joinedUsage[joinName]).filter(isNotUndefined)
    );
  }
  return {
    fields: unique(usages.map(u => u.fields).flat()),
    joinedUsage,
  };
}

export function emptyCubeUsage(): CubeUsage {
  return {fields: [], joinedUsage: {}};
}

function arrayDifference<T extends string | number | symbol>(
  a: T[],
  b: T[]
): T[] {
  const bSet = new Set(b);
  const ret: T[] = [];
  for (const value of a) {
    if (value in bSet) continue;
    ret.push(value);
  }
  return ret;
}

export function cubeUsageDifference(a: CubeUsage, b: CubeUsage): CubeUsage {
  return {
    fields: arrayDifference(a.fields, b.fields),
    joinedUsage: Object.fromEntries(
      Object.entries(a.joinedUsage)
        .map(
          ([joinName, joinedUsage]) =>
            [
              joinName,
              joinName in b.joinedUsage
                ? cubeUsageDifference(joinedUsage, b.joinedUsage[joinName])
                : joinedUsage,
            ] as [string, CubeUsage]
        )
        .filter(([_, joinedUsage]) => countCubeUsage(joinedUsage) > 0)
    ),
  };
}

export function joinedCubeUsage(
  joinPath: string[],
  cubeUsage: CubeUsage
): CubeUsage {
  if (joinPath.length === 0) return cubeUsage;
  return joinedCubeUsage(joinPath.slice(0, -1), {
    fields: [],
    joinedUsage: {[joinPath[joinPath.length - 1]]: cubeUsage},
  });
}
