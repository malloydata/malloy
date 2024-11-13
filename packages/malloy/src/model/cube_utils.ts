/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {isNotUndefined} from '../lang/utils';
import {
  CubeUsage,
  FieldDef,
  isJoinable,
  isJoined,
  isSourceDef,
  SourceDef,
} from './malloy_types';

// TODO handle joins...

type CubeError =
  | {code: 'not_a_cube'; data: {path: string[]}}
  | {code: 'cube_not_defined'; data: {path: string[]}}
  | {code: 'cube_not_a_join'; data: {path: string[]}}
  | {code: 'cube_is_not_joinable'; data: {path: string[]}}
  | {code: 'no_suitable_cube'; data: {path: string[]; fields: string[]}};

function _resolveCubeSources(
  path: string[],
  source: SourceDef,
  cubeUsage: CubeUsage
): {success: SourceDef} | {error: CubeError} {
  let base = {...source};
  if (cubeUsage.fields.length > 0) {
    if (source.type === 'cube') {
      let found = false;
      overSources: for (const inputSource of source.sources) {
        for (const usage of cubeUsage.fields) {
          // TODO handle joins
          if (
            inputSource.fields.find(f => f.as ?? f.name === usage) === undefined
          ) {
            continue overSources;
          }
        }
        const nonCubeFields = getNonCubeFields(source);
        if (inputSource.type === 'cube') {
          const resolveInner = _resolveCubeSources(
            path,
            inputSource,
            cubeUsageWithoutNonCubeFields(cubeUsage, inputSource)
          );
          if ('error' in resolveInner) {
            continue overSources;
          }
          base = {...resolveInner.success};
        } else {
          base = {...inputSource};
        }
        found = true;
        base = {
          ...base,
          fields: [...nonCubeFields, ...base.fields],
          filterList: [
            ...(source.filterList ?? []),
            ...(base.filterList ?? []),
          ],
        };
        break;
      }
      if (!found) {
        return {
          error: {
            code: 'no_suitable_cube',
            data: {fields: cubeUsage.fields, path},
          },
        };
      }
    } else {
      return {error: {code: 'not_a_cube', data: {path}}};
    }
  }
  const fieldsByName: {[name: string]: FieldDef} = {};
  for (const field of base.fields) {
    fieldsByName[field.as ?? field.name] = field;
  }
  for (const [joinName, joinedUsage] of Object.entries(cubeUsage.joinedUsage)) {
    const join = fieldsByName[joinName];
    const newPath = [...path, joinName];
    if (join === undefined) {
      return {error: {code: 'cube_not_defined', data: {path: newPath}}};
    }
    if (!isJoined(join) || !isSourceDef(join)) {
      return {error: {code: 'cube_not_a_join', data: {path: newPath}}};
    }
    const resolved = _resolveCubeSources(newPath, join, joinedUsage);
    if ('error' in resolved) {
      return resolved;
    }
    if (!isJoinable(resolved.success)) {
      return {error: {code: 'cube_is_not_joinable', data: {path: newPath}}};
    }
    fieldsByName[joinName] = {
      ...resolved.success,
      join: join.join,
      as: join.as ?? join.name,
      onExpression: join.onExpression,
    };
  }
  return {success: {...base, fields: Object.values(fieldsByName)}};
}

export function resolveCubeSources(
  source: SourceDef,
  cubeUsage: CubeUsage
):
  | {sourceDef: SourceDef; error: undefined}
  | {error: CubeError; sourceDef: undefined} {
  const result = _resolveCubeSources([], source, cubeUsage);
  if ('success' in result) {
    return {sourceDef: result.success, error: undefined};
  }
  return {sourceDef: undefined, error: result.error};
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

export function isEmptyCubeUsage(cubeUsage: CubeUsage): boolean {
  return countCubeUsage(cubeUsage) === 0;
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

export function mergeCubeUsage(
  ...usages: (CubeUsage | undefined)[]
): CubeUsage {
  const nonEmptyUsages = usages.filter(isNotUndefined);
  const joinNames = new Set(
    nonEmptyUsages.map(u => Object.keys(u.joinedUsage)).flat()
  );
  const joinedUsage = {};
  for (const joinName of joinNames) {
    joinedUsage[joinName] = mergeCubeUsage(
      ...nonEmptyUsages
        .map(u => u?.joinedUsage[joinName])
        .filter(isNotUndefined)
    );
  }
  return {
    fields: unique(nonEmptyUsages.map(u => u.fields).flat()),
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

export function cubeUsageJoinPaths(cubeUsage: CubeUsage): string[][] {
  const joinsUsed = Object.keys(cubeUsage.joinedUsage);
  return [
    ...joinsUsed.map(joinName => [joinName]),
    ...joinsUsed
      .map(joinName =>
        cubeUsageJoinPaths(cubeUsage.joinedUsage[joinName]).map(path => [
          joinName,
          ...path,
        ])
      )
      .flat(),
  ];
}

function isCubeField(fieldDef: FieldDef): boolean {
  return 'e' in fieldDef && fieldDef.e?.node === 'cubeField';
}

function getNonCubeFields(source: SourceDef): FieldDef[] {
  return source.fields.filter(f => !isCubeField(f));
}

// This is specifically for the case where the source `source` is a cube and the chosen input
// source is also a cube; if the `source` defines some fields outright, when resolving the inner
// cube, we don't want to include those fields.
function cubeUsageWithoutNonCubeFields(
  cubeUsage: CubeUsage,
  source: SourceDef
): CubeUsage {
  const sourceFieldsByName = {};
  for (const field of source.fields) {
    sourceFieldsByName[field.as ?? field.name] = field;
  }
  return {
    fields: cubeUsage.fields.filter(f => isCubeField(sourceFieldsByName[f])),
    // TODO not sure about this?
    joinedUsage: cubeUsage.joinedUsage,
  };
}
