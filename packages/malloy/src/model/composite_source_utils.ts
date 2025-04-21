/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {isNotUndefined} from '../lang/utils';
import type {
  AggregateFieldUsage,
  CompositeFieldUsage,
  DocumentLocation,
  FieldDef,
  PipeSegment,
  SourceDef,
} from './malloy_types';
import {
  isAtomic,
  isJoinable,
  isJoined,
  isSourceDef,
  isTurtle,
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
  nests: NestLevels,
  compositeFieldUsage: CompositeFieldUsage,
  narrowedCompositeFieldResolution:
    | NarrowedCompositeFieldResolution
    | undefined = undefined
):
  | {
      success: SourceDef;
      narrowedCompositeFieldResolution: NarrowedCompositeFieldResolution;
    }
  | {error: CompositeError} {
  let base = {...source};
  let narrowedSources: SingleNarrowedCompositeFieldResolution | undefined =
    undefined;
  const narrowedJoinedSources = narrowedCompositeFieldResolution?.joined ?? {};
  const nonCompositeFields = getNonCompositeFields(source);
  // This is a test for now; want to ensure that if I made `compositeFieldUsage` just `fieldUsage`, I could then
  // pick only the composite field usage out of it here. If this works, I'll likely keep this code, but change
  // all the names...
  const testCompositeFieldsThatAreDefinitelyComposite =
    compositeFieldUsage.fields.filter(fieldName => {
      const defInComposedSource = source.fields.find(
        field => field.name === fieldName
      );
      return (
        defInComposedSource &&
        isAtomic(defInComposedSource) &&
        defInComposedSource.e?.node === 'compositeField'
      );
    });
  if (
    testCompositeFieldsThatAreDefinitelyComposite.length > 0 ||
    source.type === 'composite'
  ) {
    if (source.type === 'composite') {
      let found = false;
      // The narrowed source list is either the one given when this function was called,
      // or we construct a new one from the given composite source's input sources.
      narrowedSources =
        narrowedCompositeFieldResolution?.source ??
        source.sources.map(s => ({source: s, nested: undefined}));
      // Make a copy, which we will mutate: if a source is invalid, we remove it from the list
      // and move on; if the source is a nested composite source, we narrow the resolution of
      // the inner sources and update the element in the list
      const newNarrowedSources = [...narrowedSources];
      // We iterate over the list of narrowed sources;
      overSources: for (const {
        source: inputSource,
        nested,
      } of narrowedSources) {
        const fieldNames = new Set<string>();
        for (const field of inputSource.fields) {
          if (field.accessModifier !== 'private') {
            fieldNames.add(field.as ?? field.name);
          }
        }
        for (const usage of testCompositeFieldsThatAreDefinitelyComposite) {
          if (!fieldNames.has(usage)) {
            newNarrowedSources.shift();
            continue overSources;
          }
        }
        if (inputSource.type === 'composite') {
          const resolveInner = _resolveCompositeSources(
            path,
            inputSource,
            nests,
            compositeFieldUsageWithoutNonCompositeFields(
              compositeFieldUsage,
              inputSource
            ),
            // This looks wonky, but what we're doing is taking the nested sources
            // and "promoting" them to look like they're top level sources; we will
            // then reverse this when we update the real narrowed resolution.
            {
              source:
                nested ??
                inputSource.sources.map(s => ({source: s, nested: []})),
              // Composite source inputs cannot have joins, so we don't need to
              // pass in the narrowed resolution
              joined: {},
            }
          );
          if ('error' in resolveInner) {
            newNarrowedSources.shift();
            continue overSources;
          }
          base = {...resolveInner.success};
          newNarrowedSources[0] = {
            source: inputSource,
            nested: resolveInner.narrowedCompositeFieldResolution.source,
          };
        } else {
          base = {...inputSource};
        }
        const fields = [...nonCompositeFields, ...base.fields];
        base = {
          ...base,
          fields,
          arguments: source.arguments,
          filterList: [
            ...(source.filterList ?? []),
            ...(base.filterList ?? []),
          ],
        };
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
              error: {
                code: 'composite_source_not_defined',
                data: {path: newPath},
              },
            };
          }
          if (!isJoined(join)) {
            return {
              error: {
                code: 'composite_source_not_a_join',
                data: {path: newPath},
              },
            };
          } else if (!isSourceDef(join)) {
            // Non-source join, like an array, skip it (no need to resolve)
            continue;
          }
          const resolved = _resolveCompositeSources(
            newPath,
            join,
            nests,
            joinedUsage,
            narrowedJoinedSources[joinName]
          );
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
          narrowedJoinedSources[joinName] =
            resolved.narrowedCompositeFieldResolution;
          base.fields = Object.values(fieldsByName);
        }
        // now finally we can check the required group bys...
        const checkedRequiredGroupBys = checkRequiredGroupBys(
          nests,
          fieldsByName
        );
        if (checkedRequiredGroupBys.length > 0) {
          newNarrowedSources.shift();
          continue overSources;
        }
        found = true;
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
      narrowedSources = newNarrowedSources;
    } else {
      return {error: {code: 'not_a_composite_source', data: {path}}};
    }
  }

  return {
    success: base,
    narrowedCompositeFieldResolution: {
      source: narrowedSources,
      joined: narrowedJoinedSources,
    },
  };
}

type SingleNarrowedCompositeFieldResolution = {
  source: SourceDef;
  nested?: SingleNarrowedCompositeFieldResolution | undefined;
}[];

export interface NarrowedCompositeFieldResolution {
  source: SingleNarrowedCompositeFieldResolution | undefined;
  joined: {[name: string]: NarrowedCompositeFieldResolution};
}

export function emptyNarrowedCompositeFieldResolution(): NarrowedCompositeFieldResolution {
  return {source: undefined, joined: {}};
}
// Should always give the _full_ `compositeFieldUsage`, because we only
// cross off sources until we find one that works, but that does not
// guarantee that all the remaining sources will work.
export function narrowCompositeFieldResolution(
  source: SourceDef,
  compositeFieldUsage: CompositeFieldUsage,
  narrowedCompositeFieldResolution: NarrowedCompositeFieldResolution
):
  | {
      narrowedCompositeFieldResolution: NarrowedCompositeFieldResolution;
      error: undefined;
    }
  | {error: CompositeError; narrowedCompositeFieldResolution: undefined} {
  const result = _resolveCompositeSources(
    [],
    source,
    {fields: [], nests: [], aggregateFieldUsage: []}, // Should it just be optional instead?
    compositeFieldUsage,
    narrowedCompositeFieldResolution
  );
  if ('success' in result) {
    return {
      narrowedCompositeFieldResolution: result.narrowedCompositeFieldResolution,
      error: undefined,
    };
  }
  return {narrowedCompositeFieldResolution: undefined, error: result.error};
}

export function resolveCompositeSources(
  source: SourceDef,
  segment: PipeSegment,
  compositeFieldUsage: CompositeFieldUsage
):
  | {sourceDef: SourceDef; error: undefined}
  | {error: CompositeError; sourceDef: undefined} {
  const result = _resolveCompositeSources(
    [],
    source,
    extractNestLevels(segment),
    compositeFieldUsage
  );
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
    if (bSet.has(value)) continue;
    ret.push(value);
  }
  return ret;
}

// Return all of `a`'s usage without any of `b`'s usage
export function compositeFieldUsageDifference(
  a: CompositeFieldUsage,
  b: CompositeFieldUsage
): CompositeFieldUsage {
  return {
    fields: arrayDifference(a.fields, b.fields),
    joinedUsage: Object.fromEntries(
      Object.entries(a.joinedUsage).map(
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
    // Today it is not possible for a join to be composite, so we can safely throw
    // away all join usage here...; if we ever allow joins in composite source
    // inputs, then this will need to be updated to be the joinUsage with joins
    // that are not composite filtered out...
    joinedUsage: {},
  };
}

interface NestLevels {
  fields: string[][];
  aggregateFieldUsage: AggregateFieldUsage[];
  nests: NestLevels[];
}

function extractNestLevels(segment: PipeSegment): NestLevels {
  const fields: string[][] = [];
  const nests: NestLevels[] = [];
  const aggregateFieldUsage: AggregateFieldUsage[] = [];

  if (
    segment.type === 'project' ||
    segment.type === 'partial' ||
    segment.type === 'reduce'
  ) {
    for (const field of segment.queryFields) {
      if (field.type === 'fieldref') {
        fields.push(field.path);
      } else if (field.type === 'turtle') {
        const head = field.pipeline[0];
        nests.push(extractNestLevels(head));
      } else {
        if (field.compositeFieldUsage !== undefined) {
          fields.push(...compositeFieldUsagePaths(field.compositeFieldUsage));
        }
        if (field.aggregateFieldUsage !== undefined) {
          aggregateFieldUsage.push(...field.aggregateFieldUsage);
        }
      }
    }
  }

  return {fields, nests, aggregateFieldUsage};
}

interface RequiredGroupBy {
  location: DocumentLocation;
  path: string[];
}

interface ExpandedNestLevels {
  fields: string[][];
  requiredGroupBys: RequiredGroupBy[];
  nested: ExpandedNestLevels[];
}

function expandRefs(nests: NestLevels, fields: FieldDef[]): ExpandedNestLevels {
  const newNests: NestLevels[] = [];
  const requiredGroupBys: RequiredGroupBy[] = [];
  for (const field of nests.fields) {
    const def = lookup(field, fields);
    if (isTurtle(def)) {
      const head = def.pipeline[0];
      newNests.push(extractNestLevels(head));
    } else if (isAtomic(def)) {
      if (def.aggregateFieldUsage) {
        for (const usage of def.aggregateFieldUsage) {
          for (const aggregatedField of usage.fields) {
            const aggregatedFieldDef = lookup(aggregatedField, fields);
            if (isAtomic(aggregatedFieldDef)) {
              // TODO ensure that when an aggregated field is defined in a join, that the join path is correctly modified, ugh
              for (const groupedBy of aggregatedFieldDef.groupedBy ?? []) {
                requiredGroupBys.push({
                  path: groupedBy,
                  location: usage.location,
                });
              }
            }
          }
        }
      }
    }
  }
  const nested = [...nests.nests, ...newNests].map(n => expandRefs(n, fields));
  return {fields: nests.fields, requiredGroupBys, nested};
}

function checkRequiredGroupBys(
  nests: NestLevels,
  fieldsByName: {[name: string]: FieldDef}
) {
  const expanded = expandRefs(nests, Object.values(fieldsByName));
  const unsatisfied = getUnsatisfiedRequiredGroupBys(expanded);
  return unsatisfied;
}

function getUnsatisfiedRequiredGroupBys(
  level: ExpandedNestLevels
): RequiredGroupBy[] {
  const fields = level.fields;
  const requiredGroupBys: RequiredGroupBy[] = [...level.requiredGroupBys];
  for (const nested of level.nested) {
    requiredGroupBys.push(...getUnsatisfiedRequiredGroupBys(nested));
  }

  return requiredGroupBys.filter(rgb => !fields.some(f => pathEq(f, rgb.path)));
}

function pathEq(a: string[], b: string[]) {
  return a.length === b.length && a.every((s, i) => b[i] === s);
}

function lookup(field: string[], fields: FieldDef[]): FieldDef {
  const [head, ...rest] = field;
  const def = fields.find(f => f.as ?? f.name === head);
  if (def === undefined) {
    throw new Error(
      `No definition for ${head} when resolving composite source`
    );
  }
  if (rest.length === 0) {
    return def;
  } else {
    if (isSourceDef(def)) {
      return lookup(rest, def.fields);
    }
    throw new Error(
      `${head} cannot contian ${rest.join('.')} when resolving composite source`
    );
  }
}
