/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import type {
  AggregateFieldUsage,
  FieldUsage,
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
  rootFields: FieldDef[],
  nests: NestLevels | undefined,
  fieldUsage: FieldUsage[],
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
  let joinsProcessed = false;
  let narrowedSources: SingleNarrowedCompositeFieldResolution | undefined =
    undefined;
  const narrowedJoinedSources = narrowedCompositeFieldResolution?.joined ?? {};
  const nonCompositeFields = getNonCompositeFields(source);
  const categorizedFieldUsage = categorizeFieldUsage(fieldUsage);
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
    overSources: for (const {source: inputSource, nested} of narrowedSources) {
      const fieldNames = new Set<string>();
      for (const field of inputSource.fields) {
        if (field.accessModifier !== 'private') {
          fieldNames.add(field.as ?? field.name);
        }
      }

      const fieldsForLookup = [...nonCompositeFields, ...inputSource.fields];
      const expandedCategorized = expandFieldUsage(
        categorizedFieldUsage.sourceUsage,
        fieldsForLookup
      );
      if (expandedCategorized === undefined) {
        // A lookup failed while expanding, which means this source certainly won't work
        newNarrowedSources.shift();
        continue overSources;
      }

      const compositeUsageInThisSource = expandedCategorized.sourceUsage.filter(
        f => isCompositeField(lookup(f.path, source.fields))
      );
      for (const usage of compositeUsageInThisSource) {
        if (!fieldNames.has(usage.path[0])) {
          newNarrowedSources.shift();
          continue overSources;
        }
      }
      if (inputSource.type === 'composite') {
        const resolveInner = _resolveCompositeSources(
          path,
          inputSource,
          genRootFields(rootFields, path, fieldsForLookup, false),
          nests,
          // TODO
          onlyCompositeFieldUsage(fieldUsage, inputSource),
          // This looks wonky, but what we're doing is taking the nested sources
          // and "promoting" them to look like they're top level sources; we will
          // then reverse this when we update the real narrowed resolution.
          {
            source:
              nested ?? inputSource.sources.map(s => ({source: s, nested: []})),
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
        filterList: [...(source.filterList ?? []), ...(base.filterList ?? [])],
      };

      const joinError = processJoins(
        path,
        base,
        rootFields,
        nests,
        expandedCategorized,
        narrowedJoinedSources
      );
      if (joinError !== undefined) {
        return joinError;
      }
      joinsProcessed = true;

      if (nests !== undefined) {
        const rf = genRootFields(rootFields, path, base.fields, false);
        // now finally we can check the required group bys...
        const checkedRequiredGroupBys = _checkRequiredGroupBys(path, nests, rf);
        if (checkedRequiredGroupBys.length > 0) {
          newNarrowedSources.shift();
          continue overSources;
        }
      }
      found = true;
      break;
    }
    if (!found) {
      return {
        error: {
          code: 'no_suitable_composite_source_input',
          data: {fields: [], path}, // TODO need to determine how to report this error, given the indirect nature.
        },
      };
    }
    narrowedSources = newNarrowedSources;
  }

  if (!joinsProcessed) {
    const expanded = expandFieldUsage(
      categorizedFieldUsage.sourceUsage,
      source.fields
    );
    if (expanded === undefined) {
      return {
        error: {
          code: 'no_suitable_composite_source_input',
          data: {fields: [], path}, // TODO need to determine how to report this error, given the indirect nature.
        },
      };
    }
    const joinError = processJoins(
      path,
      base,
      rootFields,
      nests,
      mergeCategorizedFieldUsage(expanded, {
        sourceUsage: [],
        joinUsage: categorizedFieldUsage.joinUsage,
      }),
      narrowedJoinedSources
    );
    if (joinError !== undefined) {
      return joinError;
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

function mergeCategorizedFieldUsage(
  ...usages: CategorizedFieldUsage[]
): CategorizedFieldUsage {
  const result: CategorizedFieldUsage = {
    sourceUsage: [],
    joinUsage: {},
  };
  for (const usage of usages) {
    result.sourceUsage.push(...usage.sourceUsage);
    for (const [joinName, joinUsage] of Object.entries(usage.joinUsage)) {
      result.joinUsage[joinName] ??= [];
      result.joinUsage[joinName].push(...joinUsage);
    }
  }
  return result;
}

function expandFieldUsage(
  fieldUsage: FieldUsage[],
  fields: FieldDef[]
): CategorizedFieldUsage | undefined {
  const allFieldPathsReferenced = [...fieldUsage];
  for (let i = 0; i < allFieldPathsReferenced.length; i++) {
    const reference = allFieldPathsReferenced[i];
    const referenceJoinPath = reference.path.slice(0, -1);
    // Look up this referenced field; if it is a composite field, then add it to the list
    // of composite fields found;
    // if it has composite usage, add those usages to the list of fields to look up next
    // if it doesn't exist, then this source won't work.
    let def: FieldDef;
    try {
      def = lookup(reference.path, fields);
    } catch {
      return undefined; // TODO maybe return some error info?
    }
    if (isAtomic(def)) {
      if (def.fieldUsage) {
        allFieldPathsReferenced.push(
          ...def.fieldUsage
            .map(u => ({
              path: [...referenceJoinPath, ...u.path],
              at: reference.at,
            }))
            .filter(
              u1 =>
                !allFieldPathsReferenced.some(u2 => pathEq(u1.path, u2.path))
            )
        );
      }
    }
  }
  return categorizeFieldUsage(allFieldPathsReferenced);
}

interface CategorizedFieldUsage {
  sourceUsage: FieldUsage[];
  joinUsage: {[joinName: string]: FieldUsage[]};
}

function categorizeFieldUsage(fieldUsage: FieldUsage[]): CategorizedFieldUsage {
  const categorized: CategorizedFieldUsage = {
    sourceUsage: [],
    joinUsage: {},
  };
  for (const usage of fieldUsage) {
    if (usage.path.length === 1) {
      categorized.sourceUsage.push(usage);
    } else {
      const joinName = usage.path[0];
      const pathInJoin = usage.path.slice(1);
      categorized.joinUsage[joinName] ??= [];
      categorized.joinUsage[joinName].push({
        path: pathInJoin,
        at: usage.at,
      });
    }
  }
  return categorized;
}

function mergeFields(...fields: FieldDef[][]): FieldDef[] {
  const fieldsByName: {[name: string]: FieldDef} = {};
  for (const list of fields) {
    for (const field of list) {
      fieldsByName[field.as ?? field.name] = field;
    }
  }
  return Object.values(fieldsByName);
}

function genRootFields(
  rootFields: FieldDef[],
  joinPath: string[],
  fields: FieldDef[],
  replace = true
): FieldDef[] {
  if (joinPath.length === 0) {
    if (replace) return [...fields];
    return mergeFields(rootFields, fields);
  }
  const headJoinName = joinPath[0];
  const fieldsByName: {[name: string]: FieldDef} = {};
  for (const field of rootFields) {
    fieldsByName[field.as ?? field.name] = field;
  }
  const join = fieldsByName[headJoinName];
  if (join === undefined) {
    throw new Error(
      `Could not find \`${headJoinName}\` in root field generation`
    );
  }
  if (!isJoined(join)) {
    throw new Error('Not a join!');
  }
  fieldsByName[headJoinName] = {
    ...join,
    fields: genRootFields(join.fields, joinPath.slice(1), fields, replace),
  };
  return Object.values(fieldsByName);
}

// Resolves composite sources for the joins of a given `base` source (a resolved source)
// Updating its `fields` list with the resolved joins
// And updating `narrowedJoinedSources` with the narrowed sources for each join
function processJoins(
  path: string[],
  base: SourceDef,
  rootFields: FieldDef[],
  nests: NestLevels | undefined,
  categorizedFieldUsage: CategorizedFieldUsage,
  narrowedJoinedSources: NarrowedCompositeFieldResolutionByJoinName
): {error: CompositeError} | undefined {
  const fieldsByName: {[name: string]: FieldDef} = {};
  for (const field of base.fields) {
    fieldsByName[field.as ?? field.name] = field;
  }
  for (const [joinName, joinedUsage] of Object.entries(
    categorizedFieldUsage.joinUsage
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
      genRootFields(rootFields, path, base.fields),
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
    narrowedJoinedSources[joinName] = resolved.narrowedCompositeFieldResolution;
    base.fields = Object.values(fieldsByName);
  }
}

type SingleNarrowedCompositeFieldResolution = {
  source: SourceDef;
  nested?: SingleNarrowedCompositeFieldResolution | undefined;
}[];

type NarrowedCompositeFieldResolutionByJoinName = {
  [name: string]: NarrowedCompositeFieldResolution;
};

export interface NarrowedCompositeFieldResolution {
  source: SingleNarrowedCompositeFieldResolution | undefined;
  joined: NarrowedCompositeFieldResolutionByJoinName;
}

export function emptyNarrowedCompositeFieldResolution(): NarrowedCompositeFieldResolution {
  return {source: undefined, joined: {}};
}

// Should always give the _full_ `fieldUsage`, because we only
// cross off sources until we find one that works, but that does not
// guarantee that all the remaining sources will work.
export function narrowCompositeFieldResolution(
  source: SourceDef,
  fieldUsage: FieldUsage[],
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
    [...source.fields],
    undefined,
    fieldUsage,
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
  fieldUsage: FieldUsage[]
):
  | {sourceDef: SourceDef; error: undefined}
  | {error: CompositeError; sourceDef: undefined} {
  const result = _resolveCompositeSources(
    [],
    source,
    [...source.fields],
    extractNestLevels(segment),
    fieldUsage
  );
  if ('success' in result) {
    return {sourceDef: result.success, error: undefined};
  }
  return {sourceDef: undefined, error: result.error};
}

export function fieldUsagePaths(fieldUsage: FieldUsage[]): string[][] {
  return fieldUsage.map(u => u.path);
}

export function formatFieldUsages(fieldUsage: FieldUsage[]) {
  const deduped: string[][] = [];
  for (const usage of fieldUsage) {
    if (!deduped.some(p => pathEq(p, usage.path))) {
      deduped.push(usage.path);
    }
  }
  const formattedUsages = deduped.map(fieldUsage =>
    formatFieldUsage(fieldUsage)
  );
  if (formattedUsages.length === 0) {
    return '';
  } else if (formattedUsages.length === 1) {
    return formattedUsages[0];
  } else if (formattedUsages.length === 2) {
    return `${formattedUsages[0]} and ${formattedUsages[1]}`;
  } else {
    return `${formattedUsages.slice(0, -1).join(', ')}, and ${
      formattedUsages[formattedUsages.length - 1]
    }`;
  }
}

function countFieldUsage(fieldUsage: FieldUsage[]): number {
  const paths: string[][] = [];
  for (const usage of fieldUsage) {
    if (!paths.some(p => pathEq(p, usage.path))) {
      paths.push(usage.path);
    }
  }
  return paths.length;
}

export function isEmptyFieldUsage(fieldUsage: FieldUsage[]): boolean {
  return countFieldUsage(fieldUsage) === 0;
}

export function fieldUsageIsPlural(fieldUsage: FieldUsage[]): boolean {
  return countFieldUsage(fieldUsage) > 1;
}

export function formatFieldUsage(fieldUsage: string[]) {
  return `\`${fieldUsage.join('.')}\``;
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function mergeFieldUsage(...usages: FieldUsage[][]): FieldUsage[];
export function mergeFieldUsage(
  ...usages: (FieldUsage[] | undefined)[]
): FieldUsage[] | undefined;
export function mergeFieldUsage(
  ...usages: (FieldUsage[] | undefined)[]
): FieldUsage[] | undefined {
  const usage: FieldUsage[] = [];
  for (const oneUsage of usages) {
    if (oneUsage === undefined) continue;
    usage.push(...oneUsage);
  }
  if (usage.length === 0) return undefined;
  return usage;
}

export function fieldUsageDifference(a: FieldUsage[], b: FieldUsage[]) {
  return a.filter(u1 => !b.some(u2 => pathEq(u1.path, u2.path)));
}

export function emptyFieldUsage(): FieldUsage[] {
  return [];
}

export function joinedFieldUsage(
  joinPath: string[],
  fieldUsage: FieldUsage[]
): FieldUsage[] {
  return fieldUsage.map(u => ({...u, path: [...joinPath, ...u.path]}));
}

export function joinedAggregateFieldUsage(
  joinPath: string[],
  aggregateFieldUsage: AggregateFieldUsage[] | undefined
): AggregateFieldUsage[] | undefined {
  if (aggregateFieldUsage === undefined) return undefined;
  return aggregateFieldUsage.map(u => ({
    ...u,
    fields: u.fields.map(f => [...joinPath, ...f]),
  }));
}

export function fieldUsageJoinPaths(fieldUsage: FieldUsage[]): string[][] {
  const joinPaths: string[][] = [];
  for (const usage of fieldUsage) {
    const joinPath = usage.path.slice(0, -1);
    if (joinPath.length === 0) continue;
    if (!joinPaths.some(j => pathEq(j, joinPath))) {
      joinPaths.push(joinPath);
    }
  }
  return joinPaths;
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
function onlyCompositeFieldUsage(
  fieldUsage: FieldUsage[],
  source: SourceDef
): FieldUsage[] {
  const sourceFieldsByName = {};
  for (const field of source.fields) {
    sourceFieldsByName[field.as ?? field.name] = field;
  }
  return fieldUsage.filter(u => {
    if (u.path.length !== 1) return false;
    const field = sourceFieldsByName[u.path[0]];
    return field !== undefined && isCompositeField(field);
  });
}

interface NestLevels {
  fieldsReferencedDirectly: FieldUsage[];
  fieldsReferenced: FieldUsage[];
  aggregateFieldUsage: AggregateFieldUsage[];
  nested: NestLevels[];
}

function extractNestLevels(segment: PipeSegment): NestLevels {
  const fieldsReferencedDirectly: FieldUsage[] = [];
  const fieldsReferenced: FieldUsage[] = [];
  const nested: NestLevels[] = [];
  const aggregateFieldUsage: AggregateFieldUsage[] = [];

  if (
    segment.type === 'project' ||
    segment.type === 'partial' ||
    segment.type === 'reduce'
  ) {
    for (const field of segment.queryFields) {
      if (field.type === 'fieldref') {
        const usage = {
          path: field.path,
          // TODO handle case where `at` is undefined
          at: field.at!,
        };
        fieldsReferencedDirectly.push(usage);
        fieldsReferenced.push(usage);
      } else if (field.type === 'turtle') {
        const head = field.pipeline[0];
        nested.push(extractNestLevels(head));
      } else {
        if (field.fieldUsage !== undefined) {
          fieldsReferenced.push(...field.fieldUsage);
        }
        if (field.aggregateFieldUsage !== undefined) {
          aggregateFieldUsage.push(...field.aggregateFieldUsage);
        }
      }
    }
  }

  return {
    fieldsReferencedDirectly,
    nested,
    aggregateFieldUsage,
    fieldsReferenced,
  };
}

interface RequiredGroupBy {
  location: DocumentLocation;
  path: string[];
}

interface ExpandedNestLevels {
  fieldsReferencedDirectly: FieldUsage[];
  requiredGroupBys: RequiredGroupBy[];
  nested: ExpandedNestLevels[];
}

function expandRefs(nests: NestLevels, fields: FieldDef[]): ExpandedNestLevels {
  const newNests: NestLevels[] = [];
  const requiredGroupBys: RequiredGroupBy[] = [];
  const allAggregateFieldUsage: AggregateFieldUsage[] = [
    ...nests.aggregateFieldUsage,
  ];
  const references = [...nests.fieldsReferenced];
  for (let i = 0; i < references.length; i++) {
    const field = references[i];
    const def = lookup(field.path, fields);
    if (isTurtle(def)) {
      const head = def.pipeline[0];
      newNests.push(extractNestLevels(head));
    } else if (isAtomic(def)) {
      const joinPath = field.path.slice(0, -1);
      if (def.aggregateFieldUsage) {
        allAggregateFieldUsage.push(
          ...joinedAggregateFieldUsage(joinPath, def.aggregateFieldUsage)!.map(
            u => ({
              ...u,
              location: field.at,
            })
          )
        );
      }
      if (def.fieldUsage) {
        const moreReferences = def.fieldUsage
          .map(u => ({path: [...joinPath, ...u.path], at: field.at}))
          .filter(u1 => !references.some(u2 => pathEq(u1.path, u2.path)));
        references.push(...moreReferences);
      }
    }
  }
  for (const usage of allAggregateFieldUsage) {
    for (const aggregatedField of usage.fields) {
      const joinPath = aggregatedField.slice(0, -1);
      const aggregatedFieldDef = lookup(aggregatedField, fields);
      if (isAtomic(aggregatedFieldDef)) {
        // TODO ensure that when an aggregated field is defined in a join, that the join path is correctly modified, ugh
        for (const groupedBy of aggregatedFieldDef.groupedBy ?? []) {
          requiredGroupBys.push({
            path: [...joinPath, ...groupedBy],
            location: usage.location,
          });
        }
      }
    }
  }
  const nested = [...nests.nested, ...newNests].map(n => expandRefs(n, fields));
  return {
    fieldsReferencedDirectly: nests.fieldsReferencedDirectly,
    requiredGroupBys,
    nested,
  };
}

function _checkRequiredGroupBys(
  joinPath: string[],
  nests: NestLevels,
  fields: FieldDef[]
): RequiredGroupBy[] {
  const expanded = expandRefs(nests, fields);
  const unsatisfied = getUnsatisfiedRequiredGroupBys(expanded);
  return unsatisfied;
}

export function checkRequiredGroupBys(
  compositeResolvedSourceDef: SourceDef,
  segment: PipeSegment
): RequiredGroupBy[] {
  const nests = extractNestLevels(segment);
  const unsatisfied = _checkRequiredGroupBys(
    [],
    nests,
    compositeResolvedSourceDef.fields
  );
  return unsatisfied;
}

function getUnsatisfiedRequiredGroupBys(
  level: ExpandedNestLevels
): RequiredGroupBy[] {
  const fields = level.fieldsReferencedDirectly;
  const requiredGroupBys: RequiredGroupBy[] = [...level.requiredGroupBys];
  for (const nested of level.nested) {
    requiredGroupBys.push(...getUnsatisfiedRequiredGroupBys(nested));
  }

  return requiredGroupBys.filter(
    rgb => !fields.some(f => pathEq(f.path, rgb.path))
  );
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
    if (isJoined(def)) {
      return lookup(rest, def.fields);
    }
    throw new Error(
      `${head} cannot contian ${rest.join('.')} when resolving composite source`
    );
  }
}
