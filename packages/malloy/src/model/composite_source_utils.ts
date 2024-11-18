/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {isNotUndefined} from '../lang/utils';
import {
  CompositeFieldUsage,
  FieldDef,
  isJoinable,
  isJoined,
  isSourceDef,
  SourceDef,
} from './malloy_types';

type CompositeError =
  | {code: 'not_a_composite_source'; data: {path: string[]}}
  | {code: 'composite_source_not_defined'; data: {path: string[]}}
  | {code: 'composite_source_not_a_join'; data: {path: string[]}}
  | {code: 'composite_source_is_not_joinable'; data: {path: string[]}}
  | {
      code: 'no_suitable_composite_source_input';
      data: {path: string[]; fields: string[]};
    };

function _resolveCompositeSources(
  path: string[],
  source: SourceDef,
  compositeFieldUsage: CompositeFieldUsage
): {success: SourceDef} | {error: CompositeError} {
  let base = {...source};
  if (compositeFieldUsage.fields.length > 0) {
    if (source.type === 'composite') {
      let found = false;
      overSources: for (const inputSource of source.sources) {
        const fieldNames = new Set<string>();
        for (const field of inputSource.fields) {
          fieldNames.add(field.as ?? field.name);
        }
        for (const usage of compositeFieldUsage.fields) {
          if (!fieldNames.has(usage)) {
            continue overSources;
          }
        }
        const nonCompositeFields = getNonCompositeFields(source);
        if (inputSource.type === 'composite') {
          const resolveInner = _resolveCompositeSources(
            path,
            inputSource,
            compositeFieldUsageWithoutNonCompositeFields(
              compositeFieldUsage,
              inputSource
            )
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
          fields: [...nonCompositeFields, ...base.fields],
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
            code: 'no_suitable_composite_source_input',
            data: {fields: compositeFieldUsage.fields, path},
          },
        };
      }
    } else {
      return {error: {code: 'not_a_composite_source', data: {path}}};
    }
  }
  const fieldsByName: {[name: string]: FieldDef} = {};
  for (const field of base.fields) {
    fieldsByName[field.as ?? field.name] = field;
  }
  for (const [joinName, joinedUsage] of Object.entries(
    compositeFieldUsage.joinedUsage
  )) {
    const join = fieldsByName[joinName];
    const newPath = [...path, joinName];
    if (join === undefined) {
      return {
        error: {code: 'composite_source_not_defined', data: {path: newPath}},
      };
    }
    if (!isJoined(join) || !isSourceDef(join)) {
      return {
        error: {code: 'composite_source_not_a_join', data: {path: newPath}},
      };
    }
    const resolved = _resolveCompositeSources(newPath, join, joinedUsage);
    if ('error' in resolved) {
      return resolved;
    }
    if (!isJoinable(resolved.success)) {
      return {
        error: {
          code: 'composite_source_is_not_joinable',
          data: {path: newPath},
        },
      };
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

export function resolveCompositeSources(
  source: SourceDef,
  compositeFieldUsage: CompositeFieldUsage
):
  | {sourceDef: SourceDef; error: undefined}
  | {error: CompositeError; sourceDef: undefined} {
  const result = _resolveCompositeSources([], source, compositeFieldUsage);
  if ('success' in result) {
    return {sourceDef: result.success, error: undefined};
  }
  return {sourceDef: undefined, error: result.error};
}

export function compositeFieldUsagePaths(
  compositeFieldUsage: CompositeFieldUsage
): string[][] {
  return [
    ...compositeFieldUsage.fields.map(f => [f]),
    ...Object.entries(compositeFieldUsage.joinedUsage)
      .map(([joinName, joinedUsage]) =>
        compositeFieldUsagePaths(joinedUsage).map(path => [joinName, ...path])
      )
      .flat(),
  ];
}

export function formatCompositeFieldUsages(
  compositeFieldUsage: CompositeFieldUsage
) {
  return compositeFieldUsagePaths(compositeFieldUsage)
    .map(compositeFieldUsage => formatCompositeFieldUsage(compositeFieldUsage))
    .join(', ');
}

function countCompositeFieldUsage(
  compositeFieldUsage: CompositeFieldUsage
): number {
  return Object.values(compositeFieldUsage.joinedUsage).reduce(
    (a, b) => a + countCompositeFieldUsage(b),
    compositeFieldUsage.fields.length
  );
}

export function isEmptyCompositeFieldUsage(
  compositeFieldUsage: CompositeFieldUsage
): boolean {
  return countCompositeFieldUsage(compositeFieldUsage) === 0;
}

export function compositeFieldUsageIsPlural(
  compositeFieldUsage: CompositeFieldUsage
): boolean {
  return countCompositeFieldUsage(compositeFieldUsage) > 1;
}

export function formatCompositeFieldUsage(compositeFieldUsage: string[]) {
  return `\`${compositeFieldUsage.join('.')}\``;
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function mergeCompositeFieldUsage(
  ...usages: (CompositeFieldUsage | undefined)[]
): CompositeFieldUsage {
  const nonEmptyUsages = usages.filter(isNotUndefined);
  const joinNames = new Set(
    nonEmptyUsages.map(u => Object.keys(u.joinedUsage)).flat()
  );
  const joinedUsage = {};
  for (const joinName of joinNames) {
    joinedUsage[joinName] = mergeCompositeFieldUsage(
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

export function emptyCompositeFieldUsage(): CompositeFieldUsage {
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

export function compositeFieldUsageDifference(
  a: CompositeFieldUsage,
  b: CompositeFieldUsage
): CompositeFieldUsage {
  return {
    fields: arrayDifference(a.fields, b.fields),
    joinedUsage: Object.fromEntries(
      Object.entries(a.joinedUsage)
        .map(
          ([joinName, joinedUsage]) =>
            [
              joinName,
              joinName in b.joinedUsage
                ? compositeFieldUsageDifference(
                    joinedUsage,
                    b.joinedUsage[joinName]
                  )
                : joinedUsage,
            ] as [string, CompositeFieldUsage]
        )
        .filter(([_, joinedUsage]) => countCompositeFieldUsage(joinedUsage) > 0)
    ),
  };
}

export function joinedCompositeFieldUsage(
  joinPath: string[],
  compositeFieldUsage: CompositeFieldUsage
): CompositeFieldUsage {
  if (joinPath.length === 0) return compositeFieldUsage;
  return joinedCompositeFieldUsage(joinPath.slice(0, -1), {
    fields: [],
    joinedUsage: {[joinPath[joinPath.length - 1]]: compositeFieldUsage},
  });
}

export function compositeFieldUsageJoinPaths(
  compositeFieldUsage: CompositeFieldUsage
): string[][] {
  const joinsUsed = Object.keys(compositeFieldUsage.joinedUsage);
  return [
    ...joinsUsed.map(joinName => [joinName]),
    ...joinsUsed
      .map(joinName =>
        compositeFieldUsageJoinPaths(
          compositeFieldUsage.joinedUsage[joinName]
        ).map(path => [joinName, ...path])
      )
      .flat(),
  ];
}

function isCompositeField(fieldDef: FieldDef): boolean {
  return 'e' in fieldDef && fieldDef.e?.node === 'compositeField';
}

function getNonCompositeFields(source: SourceDef): FieldDef[] {
  return source.fields.filter(f => !isCompositeField(f));
}

// This is specifically for the case where the source `source` is a composite and the chosen input
// source is also a composite; if the `source` defines some fields outright, when resolving the inner
// composite, we don't want to include those fields.
function compositeFieldUsageWithoutNonCompositeFields(
  compositeFieldUsage: CompositeFieldUsage,
  source: SourceDef
): CompositeFieldUsage {
  const sourceFieldsByName = {};
  for (const field of source.fields) {
    sourceFieldsByName[field.as ?? field.name] = field;
  }
  return {
    fields: compositeFieldUsage.fields.filter(f =>
      isCompositeField(sourceFieldsByName[f])
    ),
    joinedUsage: compositeFieldUsage.joinedUsage,
  };
}
