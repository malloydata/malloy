/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  BooleanFilter,
  NumberFilter,
  StringFilter,
  TemporalFilter,
} from '@malloydata/malloy-filter';
import {
  BooleanFilterExpression,
  NumberFilterExpression,
  StringFilterExpression,
  TemporalFilterExpression,
} from '@malloydata/malloy-filter';
import type {MalloyElement} from './ast';
import type {
  FieldUsage,
  FieldDef,
  PipeSegment,
  SourceDef,
  Expr,
  AggregateUngrouping,
  RequiredGroupBy,
  DocumentLocation,
  Annotation,
  PartitionCompositeDesc,
  FilterCondition,
  StructDef,
  ActiveJoin,
} from '../model/malloy_types';
import {
  expressionIsScalar,
  isAtomic,
  isIndexSegment,
  isJoinable,
  isJoined,
  isQuerySegment,
  isSourceDef,
  isTimeLiteral,
  isTurtle,
} from '../model/malloy_types';
import {isNotUndefined} from './utils';
import {pathToKey} from '../model/utils';
import {annotationToTag} from '../annotation';

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
      data: {failures: CompositeFailure[]; path: string[]; usage: FieldUsage[]};
    };

type CompositeIssue =
  | {
      type: 'join-failed';
      failures: CompositeFailure[];
      path: string[];
      firstUsage: FieldUsage;
    }
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
  fieldUsage: FieldUsage[],
  // for resolving nested composites; the list of sources to try
  sources?: SourceDef[]
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
  const expandedForError = onlyCompositeUsage(
    expandFieldUsage(fieldUsage, rootFields).result,
    source.fields
  );
  if (source.type === 'composite') {
    let found = false;
    anyComposites = true;
    const failures: CompositeFailure[] = [];
    // The narrowed source list is either the one given when this function was called,
    // or we construct a new one from the given composite source's input sources.
    const sourcesToTry = sources ?? source.sources;
    // We iterate over the list of narrowed sources;
    overSources: for (const inputSource of sourcesToTry) {
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

      const fieldUsageWithWheres =
        mergeFieldUsage(getFieldUsageFromFilterList(inputSource), fieldUsage) ??
        [];

      const fieldsForLookup = [...nonCompositeFields, ...inputSource.fields];
      const expanded = expandFieldUsage(fieldUsageWithWheres, fieldsForLookup);
      if (expanded.missingFields.length > 0) {
        // A lookup failed while expanding, which means this source certainly won't work
        for (const missingField of expanded.missingFields) {
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

      const expandedCategorized = categorizeFieldUsage(expanded.result);
      const compositeUsageInThisSource = onlyCompositeUsage(
        expandedCategorized.sourceUsage,
        source.fields
      );
      for (const usage of compositeUsageInThisSource) {
        if (usage.path.length > 0 && !fieldNames.has(usage.path[0])) {
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
      if (
        inputSource.type === 'composite' ||
        inputSource.partitionComposite !== undefined
      ) {
        const resolveInner = _resolveCompositeSources(
          path,
          inputSource,
          genRootFields(rootFields, path, fieldsForLookup, false),
          nests,
          compositeUsageInThisSource,
          inputSource.type === 'composite' ? inputSource.sources : undefined
        );
        if ('error' in resolveInner) {
          // Third point where we abort; if a nested composite failed; we don't call abort() because we want to unnest the failures from
          if (
            resolveInner.error.code === 'no_suitable_composite_source_input'
          ) {
            failures.push(...resolveInner.error.data.failures);
          } else {
            abort();
          }
          continue overSources;
        }
        base = {
          ...resolveInner.success,
          annotation: composeAnnotations(
            base.annotation,
            resolveInner.success.annotation
          ),
        };
      } else {
        base = {
          ...inputSource,
          annotation: composeAnnotations(
            base.annotation,
            inputSource.annotation
          ),
        };
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
        expandedCategorized
      );
      // Fourth point where we abort: if a join failed
      if (joinError.errors.length > 0) {
        for (const error of joinError.errors) {
          if (error.error.code !== 'no_suitable_composite_source_input') {
            return {error: error.error};
          }
          fail({
            type: 'join-failed',
            failures: error.error.data.failures,
            path: error.error.data.path,
            firstUsage: error.firstUsage,
          });
        }
        abort();
        continue overSources;
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
          data: {failures, usage: expandedForError, path},
        },
      };
    }
  } else if (source.partitionComposite !== undefined) {
    anyComposites = true;
    const expanded = expandFieldUsage(fieldUsage, rootFields).result;
    // TODO possibly abort if expanded has missing fields...
    const expandedCategorized = categorizeFieldUsage(expanded);
    const {partitionFilter, issues} = getPartitionCompositeFilter(
      source.partitionComposite,
      expandedCategorized.sourceUsage
    );
    if (issues !== undefined) {
      return {
        error: {
          code: 'no_suitable_composite_source_input',
          data: {
            failures: issues.map(iss => ({source, issues: iss})),
            usage: expanded,
            path,
          },
        },
      };
    }
    base = {
      ...source,
      filterList: [...(source.filterList ?? []), partitionFilter],
    };
  }

  if (!joinsProcessed) {
    const expanded = expandFieldUsage(
      fieldUsage,
      getJoinFields(rootFields, path)
    );
    if (expanded.missingFields.length > 0) {
      return {
        error: {
          code: 'no_suitable_composite_source_input',
          data: {failures: [], usage: expandedForError, path}, // TODO need to determine how to report this error, given the indirect nature.
        },
      };
    }
    const joinResult = processJoins(
      path,
      base,
      rootFields,
      nests,
      categorizeFieldUsage(expanded.result)
    );
    if (joinResult.errors.length > 0) {
      return {error: joinResult.errors[0].error};
    }
    anyComposites ||= joinResult.anyComposites;
  }

  return {
    success: base,
    anyComposites,
  };
}

function onlyCompositeUsage(fieldUsage: FieldUsage[], fields: FieldDef[]) {
  return fieldUsage.filter(f => {
    try {
      return isCompositeField(lookup(f.path, fields));
    } catch {
      return true;
    }
  });
}

export function getExpandedSegment(
  segment: PipeSegment,
  inputSource: SourceDef
): PipeSegment {
  if (segment.type === 'raw') return segment;
  const sourceExtensions = isQuerySegment(segment)
    ? segment.extendSource ?? []
    : [];
  const fields = mergeFields(inputSource.fields, sourceExtensions);

  const collectedUngroupings: AggregateUngrouping[] = [];
  let updatedSegment = segment;

  if (isQuerySegment(segment)) {
    // Single walk through query fields
    const updatedQueryFields = segment.queryFields.map(field => {
      if (field.type === 'fieldref') {
        // Just return it - field usage already in segment.fieldUsage
        return field;
      } else if (field.type === 'turtle') {
        if (field.pipeline.length === 0) return field;
        // Process entire turtle pipeline
        const updatedPipeline: PipeSegment[] = [];
        let turtleInput = inputSource; // First stage sees parent's input

        for (const stage of field.pipeline) {
          const processedStage = getExpandedSegment(stage, turtleInput);
          updatedPipeline.push(processedStage);

          if (processedStage.type === 'raw') continue;
          // Collect ungroupings from turtle with adjusted paths
          if (processedStage.expandedUngroupings) {
            const adjusted = processedStage.expandedUngroupings.map(u => ({
              ...u,
              path: [field.name, ...u.path],
            }));
            collectedUngroupings.push(...adjusted);
          }

          turtleInput = processedStage.outputStruct;
        }
        return {...field, pipeline: updatedPipeline};
      } else {
        // Regular fields - only collect ungroupings
        collectedUngroupings.push(...(field.ungroupings || []));
        return field;
      }
    });

    updatedSegment = {...segment, queryFields: updatedQueryFields};
  }

  const allFieldUsage = mergeFieldUsage(
    getFieldUsageFromFilterList(inputSource),
    segment.fieldUsage
  );
  const expanded = expandFieldUsage(allFieldUsage || [], fields);

  // Merge ungroupings from direct collection and field expansion
  const allUngroupings = [...collectedUngroupings, ...expanded.ungroupings];

  return {
    ...updatedSegment,
    expandedFieldUsage: expanded.result,
    activeJoins: expanded.activeJoins,
    expandedUngroupings: allUngroupings,
  };
}

interface JoinDependency {
  path: string[];
  dependsOn: Set<string>;
  checked?: boolean;
  onReferencesChildren?: boolean;
}

function getJoin(
  jdMap: Record<string, JoinDependency>,
  joinKey: string,
  joinPath: string[]
): JoinDependency {
  if (!jdMap[joinKey]) {
    jdMap[joinKey] = {path: joinPath, dependsOn: new Set()};
  }
  return jdMap[joinKey];
}

function findActiveJoins(
  dependencies: Record<string, JoinDependency>
): ActiveJoin[] {
  const sorted: ActiveJoin[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (key: string) => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      return;
    }

    visiting.add(key);
    const dep = dependencies[key];
    if (dep) {
      // Visit all dependencies first (depth-first)
      for (const depKey of dep.dependsOn) {
        visit(depKey);
      }
    }
    visiting.delete(key);
    visited.add(key);

    // Add this join's path to the sorted list after its dependencies
    if (dep) {
      sorted.push({
        path: dep.path,
        onReferencesChildren: dep.onReferencesChildren,
      });
    }
  };

  // Visit all joins in the dependency graph
  for (const key of Object.keys(dependencies)) {
    visit(key);
  }

  return sorted;
}

/**
 * Given a list of field usage requests, expand to include all the join on and join filter expressions
 * needed to be able to reference those fields.
 *
 * @returns An object containing:
 * - `result`: The expanded field usage, including usages from necessary joins
 * - `missingFields`: References to fields which could not be resolved
 * - `activeJoins`: Topologically sorted list of joins needed to resolve these uses
 */
function expandFieldUsage(
  fieldUsage: FieldUsage[],
  fields: FieldDef[]
): {
  result: FieldUsage[];
  missingFields: FieldUsage[];
  activeJoins: ActiveJoin[];
  ungroupings: AggregateUngrouping[];
} {
  const seen: Record<string, FieldUsage> = {};
  const missingFields: FieldUsage[] = [];
  const toProcess: FieldUsage[] = [];
  const activeJoinGraph: Record<string, JoinDependency> = {};
  const ungroupings: AggregateUngrouping[] = [];
  // Track field dependencies: childFieldKey -> parentFieldKey
  const fieldDependencies: Record<string, string> = {};

  // Helper function to propagate fromOnExpression updates through dependency tree
  const propagateFromOnExpression = (fieldKey: string, value: boolean) => {
    if (seen[fieldKey] && !seen[fieldKey].fromOnExpression && value) {
      seen[fieldKey].fromOnExpression = true;
      // Recursively propagate to all fields that depend on this one
      for (const [childKey, parentKey] of Object.entries(fieldDependencies)) {
        if (parentKey === fieldKey) {
          propagateFromOnExpression(childKey, true);
        }
      }
    }
  };

  // Initialize: mark original inputs and add them to processing queue
  for (const usage of fieldUsage) {
    const seenKey = pathToKey('field', usage.path);
    seen[seenKey] = usage;
    toProcess.push(usage);
  }

  // Process the expanding queue
  const fieldNameSpace = buildNamespace(fields);
  for (let i = 0; i < toProcess.length; i++) {
    const reference = toProcess[i];
    if (reference.path.length === 0) continue;

    const def = inNamespace(reference.path, fieldNameSpace);
    if (!def) {
      missingFields.push(reference);
      continue;
    }

    if (isAtomic(def)) {
      const fieldUsage = def.fieldUsage ?? [];
      // Add the atomic field's dependencies to the queue
      const refPath = reference.path.slice(0, -1);
      for (const usage of joinedFieldUsage(refPath, fieldUsage)) {
        const key = pathToKey('field', usage.path);
        if (!seen[key]) {
          seen[key] = {...usage, fromOnExpression: reference.fromOnExpression};
          toProcess.push(usage);
          // Record that this field was added because of the reference field
          const parentKey = pathToKey('field', reference.path);
          fieldDependencies[key] = parentKey;
        } else if (usage.uniqueKeyRequirement) {
          seen[key].uniqueKeyRequirement = {
            isCount:
              usage.uniqueKeyRequirement.isCount ??
              seen[key].uniqueKeyRequirement?.isCount,
          };
        }
      }

      if (def.ungroupings) {
        ungroupings.push(...joinedUngroupings(refPath, def.ungroupings));
      }
    }

    // For paths through joins, additionaly track join relationships
    for (let joinLen = 1; joinLen < reference.path.length; joinLen++) {
      const joinPath = reference.path.slice(0, joinLen);
      const joinDef = inNamespace(joinPath, fieldNameSpace);
      if (!joinDef) break;

      const joinKey = pathToKey('join', joinPath);
      const thisDep = getJoin(activeJoinGraph, joinKey, joinPath);

      if (isJoined(joinDef) && !thisDep.checked) {
        thisDep.checked = true;
        const joinFieldUsage = getJoinFieldUsage(joinDef, joinPath);

        // Add join's field dependencies to the queue
        for (const usage of joinFieldUsage) {
          const key = pathToKey('field', usage.path);
          if (!seen[key]) {
            seen[key] = usage;
            toProcess.push(usage);
          } else if (usage.fromOnExpression && !seen[key].fromOnExpression) {
            // Update existing entry and propagate to dependencies
            propagateFromOnExpression(key, true);
          }

          // Check if this join's ON expression references nested source joins
          if (
            usage.fromOnExpression &&
            usage.path.length > joinPath.length + 1
          ) {
            const nestedPath = usage.path.slice(0, joinPath.length + 1);
            const nestedDef = inNamespace(nestedPath, fieldNameSpace);
            if (nestedDef && isSourceDef(nestedDef)) {
              thisDep.onReferencesChildren = true;
            }
          }

          // Track join-to-join dependencies
          const isInternalReference =
            usage.path.length === joinPath.length + 1 &&
            pathBegins(usage.path, joinPath);
          if (!isInternalReference && usage.path.length > 1) {
            const dependencyPath = usage.path.slice(0, -1);
            const dependencyKey = pathToKey('join', dependencyPath);
            getJoin(activeJoinGraph, dependencyKey, dependencyPath);
            thisDep.dependsOn.add(dependencyKey);
          }
        }

        // After processing all field usage, check for nested references in the seen map
        for (const seenUsage of Object.values(seen)) {
          if (
            seenUsage.fromOnExpression &&
            seenUsage.path.length > joinPath.length + 1
          ) {
            // Check if this path goes through the current join
            if (pathBegins(seenUsage.path, joinPath)) {
              const nestedPath = seenUsage.path.slice(0, joinPath.length + 1);
              const nestedDef = inNamespace(nestedPath, fieldNameSpace);
              if (nestedDef && isSourceDef(nestedDef)) {
                thisDep.onReferencesChildren = true;
                break; // Only need to set it once
              }
            }
          }
        }
      }
    }
  }

  return {
    result: Object.values(seen),
    missingFields,
    activeJoins: findActiveJoins(activeJoinGraph),
    ungroupings,
  };
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
    if (usage.path.length <= 1) {
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

function getPartitionCompositePartition(
  partitionComposite: PartitionCompositeDesc,
  fieldUsage: FieldUsage[]
):
  | {partitionId: string; issues: undefined}
  | {issues: CompositeIssue[][]; partitionId: undefined} {
  const issues: CompositeIssue[][] = [];
  const compositeFieldsUsed = fieldUsage.filter(u =>
    partitionComposite.compositeFields.some(
      f => u.path.length === 1 && u.path[0] === f
    )
  );
  for (const partition of partitionComposite.partitions) {
    const missingFields = compositeFieldsUsed.filter(
      u => u.path.length !== 1 || !partition.fields.includes(u.path[0])
    );
    if (missingFields.length === 0) {
      return {partitionId: partition.id, issues: undefined};
    }
    issues.push(missingFields.map(f => ({type: 'missing-field', field: f})));
  }
  return {
    partitionId: undefined,
    issues,
  };
}

function getPartitionCompositeFilter(
  partitionComposite: PartitionCompositeDesc,
  fieldUsage: FieldUsage[]
):
  | {partitionFilter: FilterCondition; issues: undefined}
  | {issues: CompositeIssue[][]; partitionFilter: undefined} {
  const {partitionId, issues} = getPartitionCompositePartition(
    partitionComposite,
    fieldUsage
  );
  if (issues !== undefined) return {issues, partitionFilter: undefined};
  const partitionFilter: FilterCondition = {
    node: 'filterCondition',
    code: '',
    expressionType: 'scalar',
    e: {
      node: '=',
      kids: {
        left: {
          node: 'field',
          // TODO validate field exists
          path: [partitionComposite.partitionField],
        },
        right: {
          node: 'stringLiteral',
          literal: partitionId,
        },
      },
    },
  };
  return {partitionFilter, issues: undefined};
}

export function getPartitionCompositeDesc(
  annotation: Annotation | undefined,
  structDef: StructDef,
  logTo: MalloyElement
): PartitionCompositeDesc | undefined {
  if (annotation === undefined) return undefined;
  const compilerFlags = annotationToTag(annotation, {prefix: /^#!\s*/}).tag;
  const partitionCompositeTag = compilerFlags.tag(
    'experimental',
    'partition_composite'
  );
  if (partitionCompositeTag === undefined) return undefined;
  if (structDef.type === 'composite') {
    logTo.logError(
      'invalid-partition-composite',
      'Source is already composite; cannot apply partition composite'
    );
    return undefined;
  }
  const partitionField = partitionCompositeTag.text('partition_field');
  const partitionsTag = partitionCompositeTag.tag('partitions');
  if (partitionField === undefined) {
    logTo.logError(
      'invalid-partition-composite',
      'Partition composite must specify `partition_field`'
    );
    return undefined;
  }
  if (partitionsTag === undefined) {
    logTo.logError(
      'invalid-partition-composite',
      'Partition composite must specify `partitions`'
    );
    return undefined;
  }
  const partitions: {id: string; fields: string[]}[] = [];
  const allFields = new Set<string>();
  const ids = Object.keys(partitionsTag.getProperties());
  for (const id of ids) {
    const partitionTag = partitionsTag.tag(id);
    if (partitionTag === undefined) {
      logTo.logError(
        'invalid-partition-composite',
        `Invalid partition specification for \`${id}\`; must be a tag with property \\fields\``
      );
      return undefined;
    }
    const fields = Object.keys(partitionTag.getProperties());
    allFields.forEach(f => allFields.add(f));
    partitions.push({id, fields});
  }
  for (const field of [partitionField, ...allFields]) {
    const def = structDef.fields.find(f => (f.as ?? f.name) === field);
    if (def === undefined) {
      logTo.logError(
        'invalid-partition-composite',
        `Composite partition field \`${field}\` not present in source`
      );
    }
  }
  const compositeFields = structDef.fields.map(f => f.as ?? f.name);
  return {partitionField, partitions, compositeFields};
}

function composeAnnotations(
  base: Annotation | undefined,
  slice: Annotation | undefined
): Annotation | undefined {
  if (base === undefined) return slice;
  if (slice === undefined) return base;
  const notes = [...(base.notes ?? []), ...(slice.notes ?? [])];
  const blockNotes = [...(base.blockNotes ?? []), ...(slice.blockNotes ?? [])];
  return {
    inherits: composeAnnotations(base.inherits, slice.inherits),
    notes: notes.length === 0 ? undefined : notes,
    blockNotes: blockNotes.length === 0 ? undefined : blockNotes,
  };
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
): {
  errors: {error: CompositeError; firstUsage: FieldUsage}[];
  anyComposites: boolean;
} {
  let anyComposites = false;
  const fieldsByName: {[name: string]: FieldDef} = {};
  const errors: {error: CompositeError; firstUsage: FieldUsage}[] = [];
  for (const field of base.fields) {
    fieldsByName[field.as ?? field.name] = field;
  }
  for (const [joinName, joinedUsage] of Object.entries(
    categorizedFieldUsage.joinUsage
  )) {
    const newPath = [...path, joinName];
    const join = fieldsByName[joinName];
    if (join === undefined) {
      errors.push({
        error: {
          code: 'composite_source_not_defined',
          data: {path: newPath},
        },
        firstUsage: joinedUsage[0],
      });
      continue;
    }
    if (!isJoined(join)) {
      errors.push({
        error: {
          code: 'composite_source_not_a_join',
          data: {path: newPath},
        },
        firstUsage: joinedUsage[0],
      });
      continue;
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
      errors.push({
        error: resolved.error,
        firstUsage: joinedUsage[0],
      });
      continue;
    }
    if (!resolved.anyComposites) {
      continue;
    }
    anyComposites = true;
    if (!isJoinable(resolved.success)) {
      errors.push({
        error: {
          code: 'composite_source_is_not_joinable',
          data: {path: newPath},
        },
        firstUsage: joinedUsage[0],
      });
      continue;
    }
    fieldsByName[joinName] = {
      ...resolved.success,
      join: join.join,
      as: join.as ?? join.name,
      onExpression: join.onExpression,
    };
    base.fields = Object.values(fieldsByName);
  }
  return {anyComposites, errors};
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

function segmentFieldUsage(segment: PipeSegment): FieldUsage[] {
  return (
    (isQuerySegment(segment) || isIndexSegment(segment)
      ? segment.fieldUsage
      : undefined) ?? emptyFieldUsage()
  );
}

function getFieldUsageFromFilterList(source: SourceDef) {
  return (source.filterList ?? []).flatMap(filter => filter.fieldUsage ?? []);
}

export function resolveCompositeSources(
  source: SourceDef,
  segment: PipeSegment
):
  | {sourceDef: SourceDef | undefined; error: undefined}
  | {error: CompositeError; sourceDef: undefined} {
  const fieldUsage = segmentFieldUsage(segment);
  const sourceExtensions = isQuerySegment(segment)
    ? segment.extendSource ?? []
    : [];
  const nestLevels = extractNestLevels(segment);
  const fields = mergeFields(source.fields, sourceExtensions);
  const fieldUsageWithWheres =
    mergeFieldUsage(getFieldUsageFromFilterList(source), fieldUsage) ?? [];
  const result = _resolveCompositeSources(
    [],
    source,
    fields,
    nestLevels,
    fieldUsageWithWheres
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

function dedupPaths(paths: string[][]) {
  const deduped: string[][] = [];
  for (const path of paths) {
    if (!deduped.some(p => pathEq(p, path))) {
      deduped.push(path);
    }
  }
  return deduped;
}

function formatPaths(paths: string[][], combinator = 'and') {
  const deduped = dedupPaths(paths);
  const formattedUsages = deduped.map(fieldUsage =>
    formatFieldUsage(fieldUsage)
  );
  return commaAndList(formattedUsages, combinator);
}

function formatRequiredGroupings(requiredGroupings: RequiredGroupBy[]) {
  return formatPaths(
    requiredGroupings.map(g => g.path),
    'and/or'
  );
}

function commaAndList(strs: string[], combinator = 'and') {
  if (strs.length === 0) {
    return '';
  } else if (strs.length === 1) {
    return strs[0];
  } else if (strs.length === 2) {
    return `${strs[0]} ${combinator} ${strs[1]}`;
  } else {
    return `${strs.slice(0, -1).join(', ')}, ${combinator} ${
      strs[strs.length - 1]
    }`;
  }
}

export function formatFieldUsages(fieldUsage: FieldUsage[]) {
  return formatPaths(fieldUsage.map(u => u.path));
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
  return (
    ('e' in fieldDef && fieldDef.e?.node === 'compositeField') ||
    (isJoined(fieldDef) && fieldDef.type === 'composite')
  );
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
  singleValueFilters: string[][];
}

function nestLevelsAt(nests: NestLevels, at?: DocumentLocation): NestLevels {
  if (at === undefined) return nests;
  return {
    fieldsReferencedDirectly: fieldUsageAt(nests.fieldsReferencedDirectly, at),
    nested: nests.nested.map(n => nestLevelsAt(n, at)),
    fieldsReferenced: fieldUsageAt(nests.fieldsReferenced, at),
    ungroupings: ungroupingsAt(nests.ungroupings, at),
    requiredGroupBys: requiredGroupBysAt(nests.requiredGroupBys, at) ?? [],
    singleValueFilters: nests.singleValueFilters,
  };
}

function fieldUsageAt(fieldUsage: FieldUsage[], at?: DocumentLocation) {
  if (at === undefined) return fieldUsage;
  return fieldUsage.map(f => ({...f, at}));
}

function requiredGroupBysAt(
  requiredGroupBys: RequiredGroupBy[] | undefined,
  at?: DocumentLocation
) {
  if (at === undefined) return requiredGroupBys;
  return requiredGroupBys?.map(r => ({
    ...r,
    fieldUsage: r.fieldUsage ? fieldUsageAt([r.fieldUsage], at)[0] : undefined,
    at,
  }));
}

function joinedRequiredGroupBys(
  joinPath: string[],
  requiredGroupBys: RequiredGroupBy[] | undefined
): RequiredGroupBy[] | undefined {
  return requiredGroupBys?.map(r => ({
    ...r,
    path: [...joinPath, ...r.path],
  }));
}

function ungroupingsAt(
  ungroupings: AggregateUngrouping[],
  at?: DocumentLocation
) {
  if (at === undefined) return ungroupings;
  return ungroupings.map(u => ({
    ...u,
    fieldUsage: fieldUsageAt(u.fieldUsage, at),
    requiresGroupBy: requiredGroupBysAt(u.requiresGroupBy, at),
    at,
  }));
}

function joinedUngroupings(
  joinPath: string[],
  ungroupings: AggregateUngrouping[]
) {
  return ungroupings.map(u => ({
    ...u,
    fieldUsage: joinedFieldUsage(joinPath, u.fieldUsage),
    requiresGroupBy: joinedRequiredGroupBys(joinPath, u.requiresGroupBy),
    path: joinPath, // Set the path to the join path
  }));
}

function extractNestLevels(segment: PipeSegment): NestLevels {
  const fieldsReferencedDirectly: FieldUsage[] = [];
  const fieldsReferenced: FieldUsage[] = [];
  const nested: NestLevels[] = [];
  const ungroupings: AggregateUngrouping[] = [];
  const requiredGroupBys: RequiredGroupBy[] = [];
  const singleValueFilters: string[][] = [];

  if (
    segment.type === 'project' ||
    segment.type === 'partial' ||
    segment.type === 'reduce'
  ) {
    for (const field of segment.queryFields) {
      if (field.type === 'fieldref') {
        const usage = {
          path: field.path,
          at: field.at,
        };
        fieldsReferencedDirectly.push(usage);
        fieldsReferenced.push(usage);
      } else if (field.type === 'turtle') {
        const head = field.pipeline[0];
        const nestedLevels = extractNestLevels(head);

        // Check if the nested query has ANY unique key requirements
        let hasNestedUniqueKeyReqs = nestedLevels.fieldsReferenced.some(
          usage => usage.uniqueKeyRequirement
        );

        // Also check the head segment's fieldUsage directly
        if (isQuerySegment(head) && head.fieldUsage) {
          const hasDirectUniqueKeyReqs = head.fieldUsage.some(
            usage => usage.uniqueKeyRequirement
          );
          if (hasDirectUniqueKeyReqs) {
            hasNestedUniqueKeyReqs = true;
          }
        }

        // If the nested query has any unique key requirements, parent needs unique input
        if (hasNestedUniqueKeyReqs) {
          fieldsReferenced.push({
            path: [],
            uniqueKeyRequirement: {isCount: true},
            at: head.referencedAt,
          });
        }

        const adjustedUngroupings = nestedLevels.ungroupings.map(u => ({
          ...u,
          path: [field.name, ...u.path],
        }));

        nested.push(
          nestLevelsAt(
            {
              ...nestedLevels,
              ungroupings: adjustedUngroupings,
            },
            head.referencedAt
          )
        );
      } else {
        const fieldUsage = field.fieldUsage ?? [];
        fieldsReferenced.push(...fieldUsage);
        ungroupings.push(...(field.ungroupings ?? []));
        requiredGroupBys.push(...(field.requiresGroupBy ?? []));
      }
    }
    for (const filter of segment.filterList ?? []) {
      if (!expressionIsScalar(filter.expressionType)) continue;
      const fields = getSingleValueFilterFields(filter.e);
      singleValueFilters.push(...fields);
    }
  }
  const levels = {
    fieldsReferencedDirectly,
    nested,
    fieldsReferenced,
    ungroupings,
    requiredGroupBys,
    singleValueFilters,
  };
  return nestLevelsAt(levels, segment.referencedAt);
}

function getSingleValueFilterFields(filter: Expr): string[][] {
  const fieldPaths: string[][] = [];
  if (filter.node === 'and') {
    fieldPaths.push(...getSingleValueFilterFields(filter.kids.left));
    fieldPaths.push(...getSingleValueFilterFields(filter.kids.right));
  } else if (filter.node === '()') {
    fieldPaths.push(...getSingleValueFilterFields(filter.e));
  } else {
    const path = isSingleValueFilterNode(filter);
    if (path) {
      fieldPaths.push(path);
    }
  }
  return fieldPaths;
}

function isSingleValueFilterNode(e: Expr): string[] | undefined {
  if (e.node === 'filterMatch') {
    if (e.kids.expr.node === 'field') {
      const result = translateFilterExpression(e.dataType, e.kids.filterExpr);

      if (!result) return [];
      if (
        (result.parsed.operator === 'null' && !result.parsed.not) ||
        (result.kind === 'boolean' &&
          ['true', '=false', '=true'].includes(result.parsed.operator) &&
          !result.parsed.not) ||
        (result.kind === 'date' &&
          result.parsed.operator === 'in' &&
          result.parsed.in.moment === 'literal' &&
          result.parsed.in.units === 'day' &&
          !result.parsed.not) ||
        (result.kind === 'timestamp' &&
          result.parsed.operator === 'in' &&
          result.parsed.in.moment === 'literal' &&
          result.parsed.in.units === undefined &&
          !result.parsed.not) ||
        // TODO: handle 'today', 'now', 'yesterday', etc.
        ((result.kind === 'number' || result.kind === 'string') &&
          result.parsed.operator === '=' &&
          result.parsed.values.length === 1 &&
          !result.parsed.not)
      ) {
        return e.kids.expr.path;
      }
    }
  } else if (e.node === '=') {
    if (
      e.kids.left.node === 'field' &&
      (e.kids.right.node === 'true' ||
        e.kids.right.node === 'false' ||
        isTimeLiteral(e.kids.right) ||
        e.kids.right.node === 'numberLiteral' ||
        e.kids.right.node === 'stringLiteral')
    ) {
      return e.kids.left.path;
    }
  } else if (e.node === 'is-null' && e.e.node === 'field') {
    return e.e.path;
  }
}

interface ExpandedNestLevels {
  fieldsReferencedDirectly: FieldUsage[];
  requiredGroupBys: RequiredGroupBy[];
  unsatisfiableGroupBys: RequiredGroupBy[];
  nested: ExpandedNestLevels[];
  singleValueFilters: string[][];
  ungroupings: AggregateUngrouping[];
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
    if (references[i].path.length === 0) continue;
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
      const nestedLevels = extractNestLevels(head);
      // Update paths for ungroupings in nested turtle
      const adjustedLevels = {
        ...nestedLevels,
        ungroupings: nestedLevels.ungroupings.map(u => ({
          ...u,
          path: field.path, // This IS the correct path to the turtle field
        })),
      };
      newNests.push(adjustedLevels);
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
          requiredGroupBys.push({path, at: field.at, fieldUsage: field});
        }
      }
      if (def.ungroupings) {
        allUngroupings.push(
          ...joinedUngroupings(
            joinPath,
            ungroupingsAt(def.ungroupings, field.at)
          )
        );
      }
      const fieldUsage = def.fieldUsage ?? [];
      const moreReferences = fieldUsageAt(
        joinedFieldUsage(joinPath, fieldUsage),
        field.at
      ).filter(u1 => !references.some(u2 => pathEq(u1.path, u2.path)));
      references.push(...moreReferences);
    }
    if (field.path.length > 1) {
      if (!joinPathsProcessed.some(p => pathEq(p, joinPath))) {
        joinPathsProcessed.push(joinPath);
        const join = lookup(joinPath, fields);
        const joinFieldUsage = getJoinFieldUsage(join, joinPath);
        references.push(
          ...fieldUsageAt(joinFieldUsage, field.at).filter(
            u1 => !references.some(u2 => pathEq(u1.path, u2.path))
          )
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
        singleValueFilters: [],
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
    allUngroupings.push(...expanded.result.ungroupings);
  }
  return {
    result: {
      fieldsReferencedDirectly: nests.fieldsReferencedDirectly,
      requiredGroupBys,
      unsatisfiableGroupBys,
      nested,
      singleValueFilters: nests.singleValueFilters,
      ungroupings: allUngroupings,
    },
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  };
}

function getJoinFieldUsage(join: FieldDef, joinPath: string[]): FieldUsage[] {
  return (
    mergeFieldUsage(
      // For `fieldUsage` from join `where`s, we need the path including the join name
      joinedFieldUsage(
        joinPath,
        isSourceDef(join) ? getFieldUsageFromFilterList(join) : []
      ),
      // For `fieldUsage` from join `on`, we need the path excluding the join name, since it's
      // already rooted at the parent
      joinedFieldUsage(joinPath.slice(0, -1), join.fieldUsage ?? [])
    ) ?? []
  );
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
  const fields = [
    ...level.fieldsReferencedDirectly.map(f => f.path),
    ...level.singleValueFilters,
  ];
  const requiredGroupBys: RequiredGroupBy[] = [...level.requiredGroupBys];
  for (const nested of level.nested) {
    requiredGroupBys.push(...getUnsatisfiedRequiredGroupBys(nested));
  }

  return [
    ...requiredGroupBys.filter(rgb => !fields.some(f => pathEq(f, rgb.path))),
    ...level.unsatisfiableGroupBys,
  ];
}

export function pathEq(a: string[], b: string[]) {
  return a.length === b.length && a.every((s, i) => b[i] === s);
}

export function pathBegins(path: string[], prefix: string[]) {
  return path.length >= prefix.length && prefix.every((s, i) => path[i] === s);
}

type Namespace = {
  fields: Record<string, FieldDef>;
  nested: Record<string, Namespace>;
};

function buildNamespace(fields: FieldDef[]): Namespace {
  const namespace: Namespace = {
    fields: {},
    nested: {},
  };

  for (const field of fields) {
    const name = field.as ?? field.name;
    namespace.fields[name] = field;

    // If it's a join with nested fields, recursively build its hierarchy
    if (isJoined(field) && field.fields) {
      namespace.nested[name] = buildNamespace(field.fields);
    }
  }

  return namespace;
}

function inNamespace(path: string[], space: Namespace): FieldDef | undefined {
  const head = path[0];
  const def = space.fields[head];

  if (def === undefined) return def;

  if (path.length === 1) {
    return def;
  }

  const nested = space.nested[head];
  if (!nested) {
    return undefined;
  }

  return inNamespace(path.slice(1), nested);
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

function compareLocations(
  a: DocumentLocation | undefined,
  b: DocumentLocation | undefined
) {
  if (a === undefined) {
    if (b === undefined) return 0;
    return -1;
  }
  if (b === undefined) return 1;
  if (a.range.start.line < b.range.start.line) return -1;
  if (a.range.start.line > b.range.start.line) return 1;
  if (a.range.start.character < b.range.start.character) return -1;
  if (a.range.start.character > b.range.start.character) return 1;
  return 0;
}

function issueLocation(issue: CompositeIssue) {
  if (issue.type === 'missing-field') {
    return issue.field.at;
  } else if (issue.type === 'missing-required-group-by') {
    return issue.requiredGroupBy.at;
  } else {
    return issue.firstUsage.at;
  }
}

function sortIssuesByReferenceLocation(issues: CompositeIssue[]) {
  return issues.sort((a, b) => {
    return compareLocations(issueLocation(a), issueLocation(b));
  });
}

export function hasCompositesAnywhere(source: SourceDef): boolean {
  if (source.type === 'composite' || source.partitionComposite !== undefined) {
    return true;
  }
  for (const field of source.fields) {
    if (isJoined(field) && isSourceDef(field) && hasCompositesAnywhere(field)) {
      return true;
    }
  }
  return false;
}

function issueFieldUsage(issue: CompositeIssue): FieldUsage | undefined {
  if (issue.type === 'missing-field') {
    return issue.field;
  } else if (issue.type === 'missing-required-group-by') {
    return issue.requiredGroupBy.fieldUsage;
  } else {
    return undefined;
  }
}

export function logCompositeError(error: CompositeError, logTo: MalloyElement) {
  if (error.code === 'no_suitable_composite_source_input') {
    const firstFails = error.data.failures.map(failure => failure.issues[0]);
    const sorted = sortIssuesByReferenceLocation(firstFails);
    const joinPath = error.data.path;
    const usages = sorted.map(issueFieldUsage);
    const lastIssue = sorted[sorted.length - 1];
    const lastUsage = usages[usages.length - 1];
    const conflictingUsage = firstFails
      .filter(i => i.type === 'missing-field')
      .map(i => i.field);
    const fConflictingUsage = formatFieldUsages(
      joinedFieldUsage(joinPath, conflictingUsage)
    );
    const dConflictingUsage =
      conflictingUsage.length > 0
        ? `there is no composite input source which defines all of ${fConflictingUsage}`
        : undefined;
    const missingGroupBys = firstFails
      .filter(i => i.type === 'missing-required-group-by')
      .map(i => i.requiredGroupBy);
    const fMissingGroupBys = formatRequiredGroupings(missingGroupBys);
    const dGrouping = 'required group by or single value filter';
    const dMissingGroupBys =
      missingGroupBys.length > 0
        ? `there is a missing ${dGrouping} of ${fMissingGroupBys}`
        : undefined;
    const dConflictingUsageAndMissingGroupBys =
      conflictingUsage.length > 0 && missingGroupBys.length > 0
        ? `there is no composite input source which defines ${fConflictingUsage} without having an unsatisfied ${dGrouping} on ${fMissingGroupBys}`
        : undefined;
    const failedJoins = firstFails
      .filter(i => i.type === 'join-failed')
      .map(i => i.path);
    const uniqueFailedJoins = dedupPaths(failedJoins);
    const joinPlural = uniqueFailedJoins.length > 1 ? 'joins' : 'join';
    const dFailedJoins =
      failedJoins.length > 0
        ? `${joinPlural} ${formatPaths(
            uniqueFailedJoins
          )} could not be resolved`
        : undefined;
    const dLastIssue = lastUsage
      ? `uses field ${formatFieldUsages(
          joinedFieldUsage(joinPath, [lastUsage])
        )}, resulting in`
      : 'results in';
    const dIssues = dConflictingUsageAndMissingGroupBys
      ? commaAndList(
          [dConflictingUsageAndMissingGroupBys, dFailedJoins].filter(
            isNotUndefined
          )
        )
      : commaAndList(
          [dConflictingUsage, dMissingGroupBys, dFailedJoins].filter(
            isNotUndefined
          )
        );
    const message = `This operation ${dLastIssue} invalid usage of the composite source, as ${dIssues} (fields required in source: ${formatFieldUsages(
      joinedFieldUsage(joinPath, error.data.usage)
    )})`;

    logTo.logError('could-not-resolve-composite-source', message, {
      at: issueLocation(lastIssue),
    });
  } else {
    logTo.logError(
      'could-not-resolve-composite-source',
      'Could not resolve composite source'
    );
  }
}

function translateFilterExpression(
  ft: string,
  fexpr: Expr
):
  | {kind: 'date' | 'timestamp'; parsed: TemporalFilter}
  | {kind: 'string'; parsed: StringFilter}
  | {kind: 'boolean'; parsed: BooleanFilter}
  | {kind: 'number'; parsed: NumberFilter}
  | undefined {
  if (fexpr.node !== 'filterLiteral') {
    return undefined;
  }
  const fsrc = fexpr.filterSrc;
  if (ft === 'date' || ft === 'timestamp') {
    const result = TemporalFilterExpression.parse(fsrc);
    if (result.parsed) return {kind: ft, parsed: result.parsed};
  } else if (ft === 'string') {
    const result = StringFilterExpression.parse(fsrc);
    if (result.parsed) return {kind: ft, parsed: result.parsed};
  } else if (ft === 'number') {
    const result = NumberFilterExpression.parse(fsrc);
    if (result.parsed) return {kind: ft, parsed: result.parsed};
  } else if (ft === 'boolean') {
    const result = BooleanFilterExpression.parse(fsrc);
    if (result.parsed) return {kind: ft, parsed: result.parsed};
  }
  return undefined;
}
