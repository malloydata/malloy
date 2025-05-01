/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import type {MalloyElement} from '../lang/ast';
import type {
  FieldUsage,
  FieldDef,
  PipeSegment,
  SourceDef,
  Expr,
  StructDef,
  AggregateUngrouping,
  RequiredGroupBy,
  DocumentLocation,
} from './malloy_types';
import {
  isAtomic,
  isJoinable,
  isJoined,
  isQuerySegment,
  isSourceDef,
  isTurtle,
} from './malloy_types';
import {exprWalk} from './utils';

type CompositeCouldNotFindFieldError = {
  code: 'could_not_find_field';
  data: {field: FieldUsage};
};

type CompositeError =
  | {code: 'not_a_composite_source'; data: {path: string[]}}
  | CompositeCouldNotFindFieldError
  | {code: 'composite_source_not_defined'; data: {path: string[]}}
  | {code: 'composite_source_not_a_join'; data: {path: string[]}}
  | {code: 'composite_source_is_not_joinable'; data: {path: string[]}}
  | {
      code: 'no_suitable_composite_source_input';
      data: {failures: CompositeFailure[]};
    };

type CompositeIssue =
  | {type: 'missing-field'; field: FieldUsage}
  | {
      type: 'missing-required-group-by';
      requiredGroupBy: RequiredGroupBy;
    };

interface CompositeFailure {
  source: SourceDef;
  issues: CompositeIssue[];
}

function _resolveCompositeSources(
  path: string[],
  source: SourceDef,
  rootFields: FieldDef[],
  nests: NestLevels | undefined,
  fieldUsage: FieldUsage[]
):
  | {
      success: SourceDef;
      anyComposites: boolean;
    }
  | {error: CompositeError} {
  // TODO skip all this if the tree doesn't have any composite sources
  let base = {...source};
  let anyComposites = false;
  let joinsProcessed = false;
  const nonCompositeFields = getNonCompositeFields(source);
  if (source.type === 'composite') {
    let found = false;
    anyComposites = true;
    const failures: CompositeFailure[] = [];
    // The narrowed source list is either the one given when this function was called,
    // or we construct a new one from the given composite source's input sources.
    const sources = source.sources;
    // We iterate over the list of narrowed sources;
    overSources: for (const inputSource of sources) {
      let failed = false;
      const issues: CompositeIssue[] = [];
      const fail = (issue: CompositeIssue) => {
        issues.push(issue);
        failed = true;
      };
      const abort = () => {
        failures.push({issues, source: inputSource});
      };
      const fieldNames = new Set<string>();
      for (const field of inputSource.fields) {
        if (field.accessModifier !== 'private') {
          fieldNames.add(field.as ?? field.name);
        }
      }

      const fieldsForLookup = [...nonCompositeFields, ...inputSource.fields];
      const expandedCategorized = expandFieldUsage(fieldUsage, fieldsForLookup);
      if (expandedCategorized.missingFields.length > 0) {
        // A lookup failed while expanding, which means this source certainly won't work
        for (const missingField of expandedCategorized.missingFields) {
          fail({
            type: 'missing-field',
            field: missingField,
          });
        }
      }
      // First point where we abort is if we couldn't expand fields
      if (failed) {
        abort();
        continue overSources;
      }

      const compositeUsageInThisSource =
        expandedCategorized.result.sourceUsage.filter(f =>
          isCompositeField(lookup(f.path, source.fields))
        );
      for (const usage of compositeUsageInThisSource) {
        if (!fieldNames.has(usage.path[0])) {
          fail({
            type: 'missing-field',
            field: usage,
          });
        }
      }
      // Second point where we abort is if the composite simply is missing fields
      if (failed) {
        abort();
        continue overSources;
      }
      if (inputSource.type === 'composite') {
        const resolveInner = _resolveCompositeSources(
          path,
          inputSource,
          genRootFields(rootFields, path, fieldsForLookup, false),
          nests,
          compositeUsageInThisSource
        );
        if ('error' in resolveInner) {
          // Third point where we abort; if a nested composite failed
          abort();
          continue overSources;
        }
        base = {...resolveInner.success};
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
        expandedCategorized.result
      );
      // Fourth point where we abort: if a join failed we just completely give up
      if (joinError.error !== undefined) {
        return {error: joinError.error};
      }
      joinsProcessed = true;

      if (nests !== undefined) {
        const rf = genRootFields(rootFields, path, base.fields, false);
        // now finally we can check the required group bys...
        const checkedRequiredGroupBys = _checkRequiredGroupBys(nests, rf);
        if (checkedRequiredGroupBys.length > 0) {
          for (const requiredGroupBy of checkedRequiredGroupBys) {
            fail({
              type: 'missing-required-group-by',
              requiredGroupBy,
            });
          }
        }
      }
      // Last point where we abort
      if (failed) {
        abort();
        continue overSources;
      }
      found = true;
      break;
    }
    if (!found) {
      return {
        error: {
          code: 'no_suitable_composite_source_input',
          data: {failures},
        },
      };
    }
  }

  if (!joinsProcessed) {
    const expanded = expandFieldUsage(
      fieldUsage,
      getJoinFields(rootFields, path)
    );
    if (expanded.missingFields) {
      return {
        error: {
          code: 'no_suitable_composite_source_input',
          data: {failures: []}, // TODO need to determine how to report this error, given the indirect nature.
        },
      };
    }
    const joinResult = processJoins(
      path,
      base,
      rootFields,
      nests,
      expanded.result
    );
    if (joinResult.error !== undefined) {
      return {error: joinResult.error};
    }
    anyComposites ||= joinResult.anyComposites;
  }

  return {
    success: base,
    anyComposites,
  };
}

function expandFieldUsage(
  fieldUsage: FieldUsage[],
  fields: FieldDef[]
): {result: CategorizedFieldUsage; missingFields: FieldUsage[]} {
  const allFieldPathsReferenced = [...fieldUsage];
  const joinPathsProcessed: string[][] = [];
  const missingFields: FieldUsage[] = [];
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
      missingFields.push(reference);
      continue;
    }
    if (isAtomic(def)) {
      const fieldUsage = getFieldUsageForField(def);
      allFieldPathsReferenced.push(
        ...fieldUsage
          .map(u => ({
            path: [...referenceJoinPath, ...u.path],
            at: reference.at,
          }))
          .filter(
            u1 => !allFieldPathsReferenced.some(u2 => pathEq(u1.path, u2.path))
          )
      );
    }
    if (reference.path.length > 1) {
      if (!joinPathsProcessed.some(p => pathEq(p, referenceJoinPath))) {
        joinPathsProcessed.push(referenceJoinPath);
        const join = lookup(referenceJoinPath, fields);
        // Don't want to actually include the name of the join; just the path to the join
        const joinJoinPath = referenceJoinPath.slice(0, -1);
        const fieldUsage = getFieldUsageForField(join);
        allFieldPathsReferenced.push(
          ...fieldUsage
            .map(u => ({
              path: [...joinJoinPath, ...u.path],
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
  return {result: categorizeFieldUsage(allFieldPathsReferenced), missingFields};
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

function getJoinFields(rootFields: FieldDef[], joinPath: string[]): FieldDef[] {
  if (joinPath.length === 0) return rootFields;
  const join = lookup(joinPath, rootFields);
  if (!isJoined(join)) {
    throw new Error('Not a join!');
  }
  return join.fields;
}

// Resolves composite sources for the joins of a given `base` source (a resolved source)
// Updating its `fields` list with the resolved joins
// And updating `narrowedJoinedSources` with the narrowed sources for each join
function processJoins(
  path: string[],
  base: SourceDef,
  rootFields: FieldDef[],
  nests: NestLevels | undefined,
  categorizedFieldUsage: CategorizedFieldUsage
):
  | {error: CompositeError; anyComposites?: undefined}
  | {anyComposites: boolean; error?: undefined} {
  let anyComposites = false;
  const fieldsByName: {[name: string]: FieldDef} = {};
  for (const field of base.fields) {
    fieldsByName[field.as ?? field.name] = field;
  }
  for (const [joinName, joinedUsage] of Object.entries(
    categorizedFieldUsage.joinUsage
  )) {
    const newPath = [...path, joinName];
    const join = fieldsByName[joinName];
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
      joinedUsage
    );
    if ('error' in resolved) {
      return resolved;
    }
    if (!resolved.anyComposites) {
      continue;
    }
    anyComposites = true;
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
    base.fields = Object.values(fieldsByName);
  }
  return {anyComposites};
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

export function resolveCompositeSources(
  source: SourceDef,
  segment: PipeSegment,
  fieldUsage: FieldUsage[]
):
  | {sourceDef: SourceDef | undefined; error: undefined}
  | {error: CompositeError; sourceDef: undefined} {
  const sourceExtensions = isQuerySegment(segment)
    ? segment.extendSource ?? []
    : [];
  const nestLevels = extractNestLevels(segment);
  const result = _resolveCompositeSources(
    [],
    source,
    mergeFields(source.fields, sourceExtensions),
    nestLevels,
    fieldUsage
  );
  if ('success' in result) {
    if (result.anyComposites) {
      return {sourceDef: result.success, error: undefined};
    }
    return {sourceDef: undefined, error: undefined};
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

interface NestLevels {
  fieldsReferencedDirectly: FieldUsage[];
  fieldsReferenced: FieldUsage[];
  requiredGroupBys: RequiredGroupBy[];
  nested: NestLevels[];
  ungroupings: AggregateUngrouping[];
}

// function getFieldUsageForFilter(filter: FilterCondition): FieldUsage[] {
//   return getFieldUsageFromExpr(filter.e);
// }

function getFieldUsageFromExpr(expr: Expr): FieldUsage[] {
  const fieldUsage: FieldUsage[] = [];
  for (const node of exprWalk(expr)) {
    if (node.node === 'field') {
      fieldUsage.push({
        path: node.path,
        at: node.at!, // TODO
      });
    }
  }
  return fieldUsage;
}

function getFieldUsageForField(field: FieldDef): FieldUsage[] {
  if (isAtomic(field) && field.e) {
    return getFieldUsageFromExpr(field.e);
  } else if (isJoined(field) && field.onExpression) {
    return getFieldUsageFromExpr(field.onExpression);
  }
  return [];
}

function extractNestLevels(segment: PipeSegment): NestLevels {
  const fieldsReferencedDirectly: FieldUsage[] = [];
  const fieldsReferenced: FieldUsage[] = [];
  const nested: NestLevels[] = [];
  const ungroupings: AggregateUngrouping[] = [];
  const requiredGroupBys: RequiredGroupBy[] = [];

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
        fieldsReferenced.push(...getFieldUsageForField(field));
        ungroupings.push(...(field.ungroupings ?? []));
        requiredGroupBys.push(...(field.requiresGroupBy ?? []));
      }
    }
  }

  return {
    fieldsReferencedDirectly,
    nested,
    fieldsReferenced,
    ungroupings,
    requiredGroupBys,
  };
}

interface ExpandedNestLevels {
  fieldsReferencedDirectly: FieldUsage[];
  requiredGroupBys: RequiredGroupBy[];
  unsatisfiableGroupBys: RequiredGroupBy[];
  nested: ExpandedNestLevels[];
}

function expandRefs(
  nests: NestLevels,
  fields: FieldDef[]
): {result: ExpandedNestLevels; missingFields: FieldUsage[] | undefined} {
  const newNests: NestLevels[] = [];
  const requiredGroupBys: RequiredGroupBy[] = [...nests.requiredGroupBys];
  const allUngroupings: AggregateUngrouping[] = [...nests.ungroupings];
  const references = [...nests.fieldsReferenced];
  const joinPathsProcessed: string[][] = [];
  const missingFields: FieldUsage[] = [];
  for (let i = 0; i < references.length; i++) {
    const field = references[i];
    let def: FieldDef;
    try {
      def = lookup(field.path, fields);
    } catch {
      missingFields.push(field);
      continue;
    }
    const joinPath = field.path.slice(0, -1);
    if (isTurtle(def)) {
      const head = def.pipeline[0];
      newNests.push(extractNestLevels(head));
    } else if (isAtomic(def)) {
      if (def.requiresGroupBy) {
        for (const requiredGroupBy of def.requiresGroupBy) {
          const path = [...joinPath, ...requiredGroupBy.path];
          try {
            const def = lookup(path, fields);
            if (isCompositeField(def)) continue;
          } catch {
            missingFields.push(field);
            continue;
          }
          requiredGroupBys.push({path, at: field.at});
        }
      }
      if (def.ungroupings) {
        allUngroupings.push(
          ...def.ungroupings.map(u => ({
            ...u,
            requiresGroupBy: u.requiresGroupBy?.map(gb => ({
              ...gb,
              path: [...joinPath, ...gb.path],
              at: field.at,
            })),
            fieldUsage: joinedFieldUsage(joinPath, u.fieldUsage).map(u2 => ({
              ...u2,
              at: field.at,
            })),
          }))
        );
      }
      const fieldUsage = getFieldUsageForField(def);
      const moreReferences = fieldUsage
        .map(u => ({path: [...joinPath, ...u.path], at: field.at}))
        .filter(u1 => !references.some(u2 => pathEq(u1.path, u2.path)));
      references.push(...moreReferences);
    }
    // TODO this logic is super duplicated in `expandFieldUsage`
    if (field.path.length > 1) {
      if (!joinPathsProcessed.some(p => pathEq(p, joinPath))) {
        joinPathsProcessed.push(joinPath);
        const join = lookup(joinPath, fields);
        // Don't want to actually include the name of the join; just the path to the join
        const joinJoinPath = joinPath.slice(0, -1);
        const fieldUsage = getFieldUsageForField(join);
        references.push(
          ...fieldUsage
            .map(u => ({
              path: [...joinJoinPath, ...u.path],
              at: field.at,
            }))
            .filter(u1 => !references.some(u2 => pathEq(u1.path, u2.path)))
        );
      }
    }
  }
  const unsatisfiableGroupBys: RequiredGroupBy[] = [];
  for (const ungrouping of allUngroupings) {
    const expanded = expandRefs(
      {
        fieldsReferenced: ungrouping.fieldUsage,
        fieldsReferencedDirectly: [],
        ungroupings: [],
        nested: [],
        requiredGroupBys: ungrouping.requiresGroupBy ?? [],
      },
      fields
    );
    missingFields.push(...(expanded.missingFields ?? []));
    for (const field of expanded.result.requiredGroupBys) {
      if (isUngroupedBy(ungrouping, field.path)) {
        unsatisfiableGroupBys.push(field);
      }
    }
  }
  const nested: ExpandedNestLevels[] = [];
  for (const level of [...nests.nested, ...newNests]) {
    const expanded = expandRefs(level, fields);
    missingFields.push(...(expanded.missingFields ?? []));
    nested.push(expanded.result);
    unsatisfiableGroupBys.push(...expanded.result.unsatisfiableGroupBys);
  }
  return {
    result: {
      fieldsReferencedDirectly: nests.fieldsReferencedDirectly,
      requiredGroupBys,
      unsatisfiableGroupBys,
      nested,
    },
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  };
}

function isUngroupedBy(ungrouping: AggregateUngrouping, groupedBy: string[]) {
  if (ungrouping.ungroupedFields === '*') return true;
  return ungrouping.ungroupedFields.some(f => pathEq(f, groupedBy));
}

function _checkRequiredGroupBys(
  nests: NestLevels,
  fields: FieldDef[]
): RequiredGroupBy[] {
  const expanded = expandRefs(nests, fields);
  const unsatisfied = getUnsatisfiedRequiredGroupBys(expanded.result);
  return unsatisfied;
}

export function checkRequiredGroupBys(
  compositeResolvedSourceDef: SourceDef,
  segment: PipeSegment
): RequiredGroupBy[] {
  const nests = extractNestLevels(segment);
  const sourceExtensions = isQuerySegment(segment)
    ? segment.extendSource ?? []
    : [];
  const unsatisfied = _checkRequiredGroupBys(
    nests,
    mergeFields(compositeResolvedSourceDef.fields, sourceExtensions)
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

  return [
    ...requiredGroupBys.filter(
      rgb => !fields.some(f => pathEq(f.path, rgb.path))
    ),
    ...level.unsatisfiableGroupBys,
  ];
}

function pathEq(a: string[], b: string[]) {
  return a.length === b.length && a.every((s, i) => b[i] === s);
}

function lookup(field: string[], fields: FieldDef[]): FieldDef {
  const [head, ...rest] = field;
  const def = fields.find(f => (f.as ?? f.name) === head);
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

function compareLocations(a: DocumentLocation, b: DocumentLocation) {
  if (a.range.start.line < b.range.start.line) return -1;
  if (a.range.start.line > b.range.start.line) return 1;
  if (a.range.start.character < b.range.start.character) return -1;
  if (a.range.start.character > b.range.start.character) return 1;
  return 0;
}

export function sortFieldUsageByReferenceLocation(usage: FieldUsage[]) {
  return usage.sort((a, b) => compareLocations(a.at, b.at));
}

export function hasCompositesAnywhere(source: StructDef): boolean {
  if (source.type === 'composite') return true;
  for (const field of source.fields) {
    if (isJoined(field) && hasCompositesAnywhere(field)) {
      return true;
    }
  }
  return false;
}

export function logCompositeError(error: CompositeError, logTo: MalloyElement) {
  if (error.code === 'no_suitable_composite_source_input') {
    if (
      error.data.failures.length > 0 &&
      error.data.failures.every(failure => {
        return (
          failure.issues.length > 0 &&
          failure.issues.every(issue => issue.type === 'missing-field')
        );
      })
    ) {
      const firstFails = error.data.failures.map(failure => {
        if (failure.issues[0].type !== 'missing-field')
          throw new Error('Programmer error');
        return failure.issues[0].field;
      });
      const sorted = sortFieldUsageByReferenceLocation(firstFails);
      const lastUsage = sorted[sorted.length - 1];
      logTo.logError(
        'invalid-composite-field-usage',
        {
          newUsage: [lastUsage],
          allUsage: sorted,
        },
        {
          at: lastUsage.at,
        }
      );
    } else {
      const trace: string[] = [];
      const locations: DocumentLocation[] = [];
      for (let i = 0; i < error.data.failures.length; i++) {
        const summaryLines: string[] = [];
        const failure = error.data.failures[i];
        const sourceName = failure.source.as
          ? ` (\`${failure.source.as}\`)`
          : '';
        const source = `composed source #${i + 1}${sourceName}`;
        for (const issue of failure.issues) {
          if (issue.type === 'missing-field') {
            const fieldRef = `\`${issue.field.path.join('.')}\``;
            // summaryLines.push(
            //   `    - Missing field: \`${issue.field.path.join('.')}\``
            // );
            // locations.push(issue.field.at);
            logTo.logError(
              'could-not-resolve-composite-source',
              `Could not resolve composite source: missing field ${fieldRef} in ${source}`,
              {at: issue.field.at}
            );
          } else {
            const fieldRef = `\`${issue.requiredGroupBy.path.join('.')}\``;
            logTo.logError(
              'could-not-resolve-composite-source',
              `Could not resolve composite source: missing group by ${fieldRef} as required in ${source}`,
              {at: issue.requiredGroupBy.at}
            );
            // summaryLines.push(
            //   `    - Missing required group by: \`${issue.requiredGroupBy.path.join(
            //     '.'
            //   )}\``
            // );
            // locations.push(issue.requiredGroupBy.at);
          }
        }
        trace.push(summaryLines.join('\n'));
      }
      locations.sort(compareLocations);
      // for (const failure of error.data.failures) {
      //   for (const issue of failure.issues) {
      //     if (issue.type === 'missing-field') {
      //       const fieldRef = `\`${issue.field.path.join('.')}\``;
      //       logTo.logError(
      //         'could-not-resolve-composite-source',
      //         `Cannot resolve composite source: missing field ${fieldRef}`,
      //         {at: issue.field.at}
      //       );
      //     } else {
      //       const fieldRef = `\`${issue.requiredGroupBy.path.join('.')}\``;
      //       logTo.logError(
      //         'could-not-resolve-composite-source',
      //         `Cannot resolve composite source: missing required group by ${fieldRef}`,
      //         {at: issue.requiredGroupBy.at}
      //       );
      //     }
      //   }
      // }
      // logTo.logError(
      //   'could-not-resolve-composite-source',
      //   `Could not resolve composite source\n${trace.join('\n')}`,
      //   {at: locations[locations.length - 1]}
      // );
    }
  } else {
    logTo.logError(
      'could-not-resolve-composite-source',
      'Could not resolve composite source'
    );
  }
}
