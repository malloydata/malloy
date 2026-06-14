/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {UngroupNode} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsUngroupedAggregate,
  fieldUsageFrom,
} from '../../../model/malloy_types';

import {QuerySpace} from '../field-space/query-spaces';
import {ReferenceField} from '../field-space/reference-field';
import * as TDU from '../typedesc-utils';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldName, FieldSpace} from '../types/field-space';

export class ExprUngroup extends ExpressionDef {
  legalChildTypes = TDU.anyAtomicT;
  elementType = 'ungroup';
  constructor(
    readonly control: 'all' | 'exclude',
    readonly expr: ExpressionDef,
    readonly fields: FieldName[]
  ) {
    super({expr: expr, fields: fields});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const exprVal = this.expr.getExpression(fs);
    if (!expressionIsAggregate(exprVal.expressionType)) {
      return this.expr.loggedErrorExpr(
        'ungroup-of-non-aggregate',
        `${this.control}() expression must be an aggregate`
      );
    }
    if (expressionIsUngroupedAggregate(exprVal.expressionType)) {
      return this.expr.loggedErrorExpr(
        'ungroup-of-ungrouped-aggregate',
        `${this.control}() expression must not already be ungrouped`
      );
    }
    const ungroup: UngroupNode = {
      node: this.control,
      e: exprVal.value,
    };
    const ungroupFields: string[][] = [];
    if (this.typeCheck(this.expr, {...exprVal, expressionType: 'scalar'})) {
      const isExclude = this.control === 'exclude';
      // Now every mentioned field must be in the output space of one of the queries
      // of the nest tree leading to this query. If this is a source definition,
      // this is not checked until sql generation time.
      if (fs.isQueryFieldSpace() && this.fields.length > 0) {
        const dstFields: string[] = [];
        for (const mentionedField of this.fields) {
          let ofs: FieldSpace | undefined = fs.outputSpace();
          let notFound = true;
          while (ofs) {
            const entryInfo = ofs.lookup([mentionedField]);
            if (entryInfo.found && entryInfo.isOutputField) {
              dstFields.push(mentionedField.refString);
              if (entryInfo.found instanceof ReferenceField) {
                ungroupFields.push(
                  entryInfo.found.fieldRef.list.map(n => n.refString)
                );
              }
              notFound = false;
            } else if (ofs instanceof QuerySpace) {
              // should always be true, but don't have types right, thus the if
              ofs = ofs.nestParent;
              continue;
            }
            break;
          }
          if (notFound) {
            const uName = isExclude ? 'exclude()' : 'all()';
            mentionedField.logError(
              'ungroup-field-not-in-output',
              `${uName} '${mentionedField.refString}' is missing from query output`
            );
          }
        }
        ungroup.fields = dstFields;
      }
      const fieldUsage = fieldUsageFrom(exprVal.refSummary);
      return {
        ...TDU.atomicDef(exprVal),
        expressionType: 'ungrouped_aggregate',
        value: ungroup,
        evalSpace: 'output',
        refSummary: exprVal.refSummary,
        ungroupings: [
          {
            requiresGroupBy: exprVal.requiresGroupBy ?? [],
            fieldUsage,
            ungroupedFields: isExclude ? (ungroupFields ?? []) : '*',
            path: [],
            exclude: isExclude,
            refFields: ungroup.fields,
          },
        ],
      };
    }
    return this.loggedErrorExpr(
      'ungroup-with-non-scalar',
      `${this.control}() incompatible type`
    );
  }
}
