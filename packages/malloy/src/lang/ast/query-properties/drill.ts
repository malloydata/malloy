/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  mergeFieldUsage,
  pathBegins,
  pathEq,
} from '../../../model/composite_source_utils';
import type {
  AtomicFieldDef,
  Expr,
  FieldDef,
  FieldUsage,
  FilterCondition,
  PipeSegment,
  TurtleDef,
  TypeDesc,
} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsAnalytic,
  isAtomic,
  isQuerySegment,
} from '../../../model/malloy_types';
import {isNotUndefined} from '../../utils';
import {ExprCompare} from '../expressions/expr-compare';
import {PermissiveSpace} from '../field-space/permissive-space';
import {ViewField} from '../field-space/view-field';
import type {FieldReference} from '../query-items/field-references';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';

import {FieldName, type FieldSpace} from '../types/field-space';
import type {Literal} from '../types/literal';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';
import {SpaceField} from '../types/space-field';
import type {FilterElement} from './filters';
import {Filter} from './filters';

export class DrillField extends ExpressionDef {
  elementType = 'drillField';
  constructor(
    readonly expr: Expr,
    readonly typeDesc: TypeDesc
  ) {
    super();
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return {
      value: this.expr,
      ...this.typeDesc,
    };
  }
}

export class Drill extends Filter implements QueryPropertyInterface {
  elementType = 'drill';
  forceQueryClass = undefined;
  queryRefinementStage = LegalRefinementStage.Head;

  protected checkedDrillCondition(
    fs: FieldSpace,
    filter: FilterElement,
    reference: FieldReference,
    value: Literal
  ): FilterCondition | undefined {
    const permissiveFS = new PermissiveSpace(fs);
    const normalLookup = fs.lookup(reference.list);
    if (normalLookup.found) {
      const cond = super.checkedFilterCondition(fs, filter);
      if (cond) return cond;
      return undefined;
    }
    if (!fs.isQueryFieldSpace()) {
      // This is really an internal error, this should not happen
      filter.logError('illegal-drill', 'Drill only allowed in query');
      return;
    }
    const drillDimensions = fs.outputSpace().drillDimensions;
    let collectedWheres: Expr | undefined = undefined;
    let collectedWhereFieldUsage: FieldUsage[] | undefined = undefined;
    if (reference.list.length === 0) {
      filter.logError('invalid-drill-reference', 'Invalid drill reference`');
      return;
    } else if (reference.list.length < 2) {
      filter.logError(
        'invalid-drill-reference',
        'Drill reference be a view name followed by a path to a field in that view, e.g. `some_view.some_nest.some_field`'
      );
      return;
    }
    const [viewName, ...path] = reference.list;
    const viewLookup = fs.lookup([viewName]);
    // TODO register reference to view
    if (viewLookup.found === undefined) {
      viewName.logError(
        'drill-view-reference-not-found',
        `No such view \`${viewName.refString}\``
      );
      return;
    }
    if (viewLookup.found.refType !== 'field') {
      viewName.logError(
        'drill-view-reference-not-field',
        `Head of drill reference must be a view, not a ${viewLookup.found.refType}`
      );
      return;
    }
    const typeDesc = viewLookup.found.typeDesc();
    if (
      typeDesc.type !== 'turtle' ||
      !(viewLookup.found instanceof ViewField)
    ) {
      const typeName = isAtomic(typeDesc) ? typeDesc.type : 'join'; // TODO test this?
      filter.logError(
        'drill-view-reference-not-view',
        `Head of drill reference must be a view, not a ${typeName}`
      );
      return;
    }
    const fieldName = path[path.length - 1];
    let currentView = viewLookup.found.fieldDef();
    let previousName = viewName;
    let fieldDef: AtomicFieldDef | undefined = undefined;
    let compareField: Expr | undefined = undefined;
    const requiredDimensions: string[][] = [];
    const pathSoFar: string[] = [viewName.name];
    for (const name of path) {
      // TODO can you even `drill` with a pipelined view?
      const segment = currentView.pipeline[currentView.pipeline.length - 1];
      if (segment.type === 'index') {
        previousName.logError(
          'drill-incompatible-segment',
          'Index segments are not compatible with `drill:`'
        );
        return;
      } else if (segment.type === 'partial') {
        previousName.logError(
          'drill-incompatible-segment',
          'Partial segments are not compatible with `drill:`'
        );
        return;
      } else if (segment.type === 'raw') {
        previousName.logError(
          'drill-incompatible-segment',
          '`drill:` is not compatible with SQL queries'
        );
        return;
      }
      const segmentDimensions = segment.queryFields
        .map(f => {
          let fieldDef: FieldDef | undefined = undefined;
          if (f.type === 'fieldref') {
            const morePathFieldNames = f.path.map(n => new FieldName(n));
            this.has({morePathFieldNames});
            const lookup = fs.lookup(morePathFieldNames);
            if (lookup.found && lookup.found instanceof SpaceField) {
              fieldDef = lookup.found.fieldDef();
              if (fieldDef && isAtomic(fieldDef))
                return f.path[f.path.length - 1];
            }
            return undefined;
          } else {
            if (isAtomic(f)) return f.as ?? f.name;
          }
        })
        .filter(isNotUndefined);
      requiredDimensions.push(...segmentDimensions.map(f => [...pathSoFar, f]));
      // Only collect filters from nests if they haven't been collected in a previous drill clause
      if (!drillDimensions.some(n => pathBegins(n.nestPath, pathSoFar))) {
        for (const filter of segment.filterList ?? []) {
          if (collectedWheres === undefined) {
            collectedWheres = filter.e;
            collectedWhereFieldUsage = filter.fieldUsage;
          } else {
            collectedWheres = {
              node: 'and',
              kids: {
                left: collectedWheres,
                right: filter.e,
              },
            };
            collectedWhereFieldUsage = mergeFieldUsage(
              collectedWhereFieldUsage,
              filter.fieldUsage
            );
          }
        }
      }
      const field = segment.queryFields.find(f => {
        if (f.type === 'fieldref') {
          return f.path[f.path.length - 1] === name.refString;
        } else {
          return f.as ?? f.name === name.refString;
        }
      });
      if (field === undefined) {
        if (name === fieldName) {
          name.logError(
            'drill-field-not-found',
            `No such field \`${name.refString}\` found in \`${previousName.refString}\``
          );
        } else {
          name.logError(
            'drill-nest-not-found',
            `No such nest \`${name.refString}\` found in \`${previousName.refString}\``
          );
        }
        return;
      }

      if (name === fieldName) {
        if (field.type === 'fieldref') {
          const pathFieldNames = field.path.map(n => new FieldName(n));
          this.has({pathFieldNames});
          const nestLookup = permissiveFS.lookup(pathFieldNames);
          if (nestLookup.found === undefined) {
            name.logError(
              'drill-view-reference-not-found',
              `No such field \`${name.refString}\``
            );
            return;
          }
          if (!(nestLookup.found instanceof SpaceField)) {
            name.logError(
              'drill-field-reference-not-field',
              'Final element of drill path must be a field'
            );
            return;
          }
          const theFieldDef = nestLookup.found.fieldDef();
          if (theFieldDef === undefined || isAtomic(theFieldDef)) {
            fieldDef = theFieldDef;
            compareField = {node: 'field', path: field.path};
          } else {
            name.logError(
              'drill-field-reference-not-field',
              'Final element of drill path must be a field'
            );
            return;
          }
        } else if (isAtomic(field)) {
          fieldDef = field;
          compareField = field.e;
        }
      } else {
        let nestDef: TurtleDef | undefined = undefined;
        if (field.type === 'fieldref') {
          const pathFieldNames = field.path.map(n => new FieldName(n));
          this.has({pathFieldNames});
          const nestLookup = permissiveFS.lookup(pathFieldNames);
          if (nestLookup.found === undefined) {
            name.logError(
              'drill-view-reference-not-found',
              `No such view ${name.refString}`
            );
            return;
          }
          if (!(nestLookup.found instanceof ViewField)) {
            name.logError(
              'drill-view-reference-not-view',
              'Middle elements of drill path must be nested views'
            );
            return;
          }
          nestDef = nestLookup.found.fieldDef();
        } else if (field.type === 'turtle') {
          nestDef = field;
        } else {
          name.logError(
            'drill-view-reference-not-view',
            'Middle elements of drill path must be nested views'
          );
          return;
        }
        currentView = nestDef;
        previousName = name;
        pathSoFar.push(name.name);
      }
    }

    if (fieldDef === undefined || compareField === undefined) {
      filter.logError(
        'invalid-drill-reference',
        'Could not determine drill field'
      );
      return;
    }

    const isAggregate = expressionIsAggregate(fieldDef.expressionType);
    const isAnalytic = expressionIsAnalytic(fieldDef.expressionType);
    if (isAnalytic) {
      filter.logError(
        'analytic-in-drill',
        'Analytic expressions are not allowed in `drill:`'
      );
      return;
    } else if (isAggregate) {
      filter.logError(
        'aggregate-in-drill',
        'Aggregate expressions are not allowed in `drill:`'
      );
    }

    // Add entries for all the other dimensions (to make sure they get satisfied eventually)
    for (const dimensionPath of requiredDimensions) {
      let drillDimension = drillDimensions.find(drillDimension => {
        return pathEq(drillDimension.dimensionPath, dimensionPath);
      });
      if (drillDimension === undefined) {
        drillDimension = {
          nestPath: dimensionPath.slice(0, -1),
          firstDrill: filter,
          dimensionPath,
          satisfied: false,
        };
        drillDimensions.push(drillDimension);
      }
    }

    // Find the entry for this one, and mark it as satisfied
    const dimensionPath = reference.list.map(f => f.name);
    const drillDimension = drillDimensions.find(drillDimension => {
      return pathEq(drillDimension.dimensionPath, dimensionPath);
    });
    if (drillDimension !== undefined) {
      drillDimension.satisfied = true;
    }

    const drillField = new DrillField(compareField, {
      ...fieldDef,
      evalSpace: 'output',
      expressionType: fieldDef.expressionType ?? 'scalar',
      fieldUsage: fieldDef.fieldUsage ?? [],
    });
    filter.has({drillField});
    const fExpression = new ExprCompare(drillField, '=', value);
    this.has({fExpression});

    const fExpr = fExpression.getExpression(permissiveFS);

    // TODO valid type of filter condition to be only boolean

    const exprCond: FilterCondition = {
      node: 'filterCondition',
      code: filter.exprSrc,
      e:
        collectedWheres === undefined
          ? fExpr.value
          : {
              node: 'and',
              kids: {left: collectedWheres, right: fExpr.value},
            },
      expressionType: fExpr.expressionType,
      fieldUsage: mergeFieldUsage(fExpr.fieldUsage, collectedWhereFieldUsage),
    };
    return exprCond;
  }

  protected checkedFilterCondition(
    fs: FieldSpace,
    filter: FilterElement
  ): FilterCondition | undefined {
    const drillFilter = filter.drillFilter();
    if (drillFilter !== undefined) {
      return this.checkedDrillCondition(
        fs,
        filter,
        drillFilter.reference,
        drillFilter.value
      );
    } else {
      return super.checkedFilterCondition(fs, filter);
    }
  }
}

export function attachDrillPaths(
  pipeline: PipeSegment[],
  name: string
): PipeSegment[] {
  if (pipeline.length !== 1) return pipeline;
  if (!isQuerySegment(pipeline[0])) return pipeline;
  return [
    {
      ...pipeline[0],
      filterList: pipeline[0].filterList?.map(f => ({
        ...f,
        drillView: name,
      })),
      queryFields: pipeline[0].queryFields.map(f => ({
        ...f,
        drillView: name,
      })),
    },
  ];
}
