/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {emptyCompositeFieldUsage} from '../../../model/composite_source_utils';
import type {
  AtomicFieldDef,
  Expr,
  FilterCondition,
  TurtleDef,
  TypeDesc,
} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsAnalytic,
  isAtomic,
} from '../../../model/malloy_types';
import {isNotUndefined} from '../../utils';
import {ExprCompare} from '../expressions/expr-compare';
import {ViewField} from '../field-space/view-field';
import type {DrillFieldReference} from '../query-items/field-references';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';

import {FieldName, type FieldSpace} from '../types/field-space';
import type {Literal} from '../types/literal';
import {ListOf, MalloyElement} from '../types/malloy-element';
import type {QueryBuilder} from '../types/query-builder';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';
import {SpaceField} from '../types/space-field';

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

export class DrillElement extends MalloyElement {
  elementType = 'filterElement';
  constructor(
    readonly field: DrillFieldReference,
    readonly value: Literal,
    readonly exprSrc: string
  ) {
    super({value, field});
  }
}

export class Drill
  extends ListOf<DrillElement>
  implements QueryPropertyInterface
{
  elementType = 'drill';
  forceQueryClass = undefined;
  queryRefinementStage = LegalRefinementStage.Head;

  protected checkedFilterCondition(
    fs: FieldSpace,
    drill: DrillElement
  ): FilterCondition[] | undefined {
    const collectedWheres: FilterCondition[] = [];
    if (drill.field.list.length === 0) {
      drill.logError('invalid-drill-reference', 'Invalid drill reference`');
      return;
    } else if (drill.field.list.length < 2) {
      drill.logError(
        'invalid-drill-reference',
        'Drill reference be a view name followed by a path to a field in that view, e.g. `some_view.some_nest.some_field`'
      );
      return;
    }
    const [viewName, ...path] = drill.field.list;
    const viewLookup = fs.lookup([viewName]);
    // TODO register reference to view
    if (viewLookup.found === undefined) {
      drill.logError(
        'drill-view-reference-not-found',
        `No such view \`${viewName.refString}\``
      );
      return;
    }
    if (viewLookup.found.refType !== 'field') {
      drill.logError(
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
      drill.logError(
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
      collectedWheres.push(...(segment.filterList ?? []));
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
          const nestLookup = fs.lookup(pathFieldNames);
          if (nestLookup.found === undefined) {
            name.logError(
              'drill-view-reference-not-found',
              `No such field ${name.refString}`
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
          const nestLookup = fs.lookup(pathFieldNames);
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
      }
    }

    if (fieldDef === undefined || compareField === undefined) {
      drill.logError(
        'invalid-drill-reference',
        'Could not determine drill field'
      );
      return;
    }

    const isAggregate = expressionIsAggregate(fieldDef.expressionType);
    const isAnalytic = expressionIsAnalytic(fieldDef.expressionType);
    if (isAnalytic) {
      drill.logError(
        'analytic-in-drill',
        'Analytic expressions are not allowed in `drill:`'
      );
      return;
    } else if (isAggregate) {
      drill.logError(
        'aggregate-in-drill',
        'Aggregate expressions are not allowed in `drill:`'
      );
    }

    const drillField = new DrillField(compareField, {
      ...fieldDef,
      evalSpace: 'output',
      expressionType: fieldDef.expressionType ?? 'scalar',
      compositeFieldUsage:
        fieldDef.compositeFieldUsage ?? emptyCompositeFieldUsage(),
    });
    drill.has({drillField});
    const fExpression = new ExprCompare(drillField, '=', drill.value);
    this.has({fExpression});

    const fExpr = fExpression.getExpression(fs); // TODO might somehow have to bypass private??

    // TODO valid type of filter condition to be only equality

    const exprCond: FilterCondition = {
      node: 'filterCondition',
      code: drill.exprSrc,
      e: fExpr.value,
      expressionType: fExpr.expressionType,
      compositeFieldUsage: fExpr.compositeFieldUsage,
    };
    return [...collectedWheres, exprCond];
  }

  getFilterList(fs: FieldSpace): FilterCondition[] {
    // TODO ensure that the rules for drilling are followed:
    // - can have any number of top level views
    // - but can only go deeper than depth 0 in ONE of them
    // - for each nest deep in that one view; cannot go into any other nests at that level
    // e.g.
    // a = 1
    // b = 1
    // c.d.e = 1
    // but not
    // a.b = 1
    // c.d = 2
    // or
    // a.b.c = 1
    // a.d.e = 1
    return this.list
      .map(filter => this.checkedFilterCondition(fs, filter))
      .filter(isNotUndefined)
      .flat();
  }

  queryExecute(executeFor: QueryBuilder) {
    const filterFS = executeFor.inputFS;
    for (const drill of this.list) {
      const fExpr = this.checkedFilterCondition(filterFS, drill);
      if (fExpr !== undefined) {
        executeFor.filters.push(...fExpr);
        for (const f of fExpr) {
          executeFor.resultFS.addCompositeFieldUserFromFilter(f, drill);
        }
      }
    }
  }
}
