/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {isNotUndefined} from '../lang/utils';
import {CubeUsage, RecordSet, SourceDef} from './malloy_types';

// TODO handle joins...
export function resolveCubeSource(
  sources: SourceDef[],
  cubeUsage: CubeUsage
): SourceDef | undefined {
  overSources: for (const source of sources) {
    for (const usage in cubeUsage.fields) {
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
    ...Object.keys(cubeUsage.fields).map(f => [f]),
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
    Object.keys(cubeUsage.fields).length
  );
}

export function cubeUsageIsPlural(cubeUsage: CubeUsage): boolean {
  return countCubeUsage(cubeUsage) > 1;
}

export function formatCubeUsage(cubeUsage: string[]) {
  return `\`${cubeUsage.join('.')}\``;
}

export function makeRecordSet<T extends number | string | symbol>(
  ...values: T[]
): RecordSet<T> {
  const ret: RecordSet<T> = {};
  for (const value of values) {
    ret[value] = true;
  }
  return ret;
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
    fields: makeRecordSet(...usages.map(u => Object.keys(u.fields)).flat()),
    joinedUsage,
  };
}

export function emptyCubeUsage(): CubeUsage {
  return {fields: {}, joinedUsage: {}};
}

function recordSetDifference<T extends string | number | symbol>(
  a: RecordSet<T>,
  b: RecordSet<T>
): RecordSet<T> {
  const ret: RecordSet<T> = {};
  for (const key in a) {
    if (key in b) continue;
    ret[key] = true;
  }
  return ret;
}

export function cubeUsageDifference(a: CubeUsage, b: CubeUsage): CubeUsage {
  return {
    fields: recordSetDifference(a.fields, b.fields),
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
    fields: {},
    joinedUsage: {[joinPath[joinPath.length - 1]]: cubeUsage},
  });
}
