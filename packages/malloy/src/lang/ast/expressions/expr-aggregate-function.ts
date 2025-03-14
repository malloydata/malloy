/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {
  AggregateFunctionType,
  FieldDef,
  AggregateExpr,
  Expr,
} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  isAtomicFieldType,
  hasExpression,
  isAtomic,
  isJoined,
} from '../../../model/malloy_types';
import {exprWalk} from '../../../model/utils';

import {errorFor} from '../ast-utils';
import {StructSpaceField} from '../field-space/static-space';
import * as TDU from '../typedesc-utils';
import {FieldReference} from '../query-items/field-references';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {SpaceField} from '../types/space-field';
import {ExprIdReference} from './expr-id-reference';
import type {JoinPath, JoinPathElement} from '../types/lookup-result';
import type {MessageCode} from '../../parse-log';

export abstract class ExprAggregateFunction extends ExpressionDef {
  elementType: string;
  source?: FieldReference;
  expr?: ExpressionDef;
  explicitSource?: boolean;
  legalChildTypes = [TDU.numberT];
  constructor(
    readonly func: AggregateFunctionType,
    expr?: ExpressionDef,
    explicitSource?: boolean
  ) {
    super();
    this.elementType = func;
    this.explicitSource = explicitSource;
    if (expr) {
      this.expr = expr;
      this.has({expr: expr});
    }
  }
  abstract returns(fromExpr: ExprValue): ExprValue;

  getExpression(fs: FieldSpace): ExprValue {
    // It is never useful to use output fields in an aggregate expression
    // so we don't even allow them to be referenced at all
    const inputFS = fs.isQueryFieldSpace() ? fs.inputSpace() : fs;
    let expr: FieldReference | ExpressionDef | undefined = this.expr;
    let exprVal = this.expr?.getExpression(inputFS);
    let structPath = this.source?.path;
    let sourceRelationship: JoinPathElement[] = [];
    if (this.source) {
      const result = this.source.getField(inputFS);
      if (result.found) {
        sourceRelationship = result.joinPath;
        const sourceFoot = result.found;
        const footType = sourceFoot.typeDesc();
        if (!(sourceFoot instanceof StructSpaceField)) {
          if (isAtomicFieldType(footType.type)) {
            expr = this.source;
            exprVal = {
              ...TDU.atomicDef(footType),
              expressionType: footType.expressionType,
              value:
                footType.evalSpace === 'output'
                  ? {node: 'outputField', name: this.source.refString}
                  : {node: 'field', path: this.source.path},
              evalSpace: footType.evalSpace,
              compositeFieldUsage: footType.compositeFieldUsage,
            };
            structPath = this.source.path.slice(0, -1);
            // Here we handle a special case where you write `foo.agg()` and `foo` is a
            // dimension which uses only one distinct join path; in this case, we set the
            // locality to be that join path
            const joinUsage = this.getJoinUsage(inputFS);
            const allUsagesSame =
              joinUsage.length === 1 ||
              (joinUsage.length > 1 &&
                joinUsage.slice(1).every(p => joinPathEq(p, joinUsage[0])));
            if (allUsagesSame) {
              structPath = joinUsage[0].map(p => p.name);
              sourceRelationship = joinUsage[0];
            }
          } else {
            return this.loggedErrorExpr(
              'invalid-aggregate-source',
              `Aggregate source cannot be a ${footType.type}`
            );
          }
        }
      } else {
        return this.loggedErrorExpr(
          'aggregate-source-not-found',
          `Reference to undefined value ${this.source.refString}`
        );
      }
    }
    if (exprVal === undefined) {
      return this.loggedErrorExpr(
        'missing-aggregate-expression',
        'Missing expression for aggregate function'
      );
    }
    if (expressionIsAggregate(exprVal.expressionType)) {
      return this.loggedErrorExpr(
        'aggregate-of-aggregate',
        'Aggregate expression cannot be aggregate'
      );
    }
    const isAnError = exprVal.type === 'error';
    if (!isAnError) {
      const joinUsage = this.getJoinUsage(inputFS);
      // Did the user spceify a source, either as `source.agg()` or `path.to.join.agg()` or `path.to.field.agg()`
      const sourceSpecified = this.source !== undefined || this.explicitSource;
      if (expr) {
        // Is this an `agg(field)`, where field uses no joins (or nested fields)
        const noJoinField =
          !this.source && joinUsage.every(usage => usage.length === 0);
        if (!noJoinField && !this.isSymmetricFunction()) {
          const usagePaths = getJoinUsagePaths(sourceRelationship, joinUsage);
          const joinError = validateUsagePaths(this.elementType, usagePaths);
          const message = sourceSpecified
            ? joinError?.message
            : 'Join path is required for this calculation';
          if (message) {
            const errorWithSuggestion = suggestNewVersion(
              message,
              joinUsage,
              expr,
              this.elementType
            );
            const code = joinError?.code ?? 'bad-join-usage';
            if (joinError) {
              this.logError(code, errorWithSuggestion);
            } else {
              this.logWarning(code, errorWithSuggestion);
            }
          }
        }
      }
    }
    if (
      this.typeCheck(this.expr || this, {
        ...exprVal,
        expressionType: 'scalar',
      })
    ) {
      const f: AggregateExpr = {
        node: 'aggregate',
        function: this.func,
        e: exprVal.value,
      };
      if (structPath && structPath.length > 0) {
        f.structPath = structPath;
      }
      return {
        ...this.returns(exprVal),
        expressionType: 'aggregate',
        value: f,
        evalSpace: 'output',
      };
    }
    return errorFor('aggregate type check');
  }

  isSymmetricFunction() {
    return true;
  }

  getJoinUsage(fs: FieldSpace) {
    const result: JoinPath[] = [];
    if (this.source) {
      const lookup = this.source.getField(fs);
      if (lookup.found) {
        const sfd: Expr = {node: 'field', path: this.source.path};
        result.push(...getJoinUsage(fs, sfd));
      }
    }
    if (this.expr) {
      const efd = this.expr.getExpression(fs).value;
      result.push(...getJoinUsage(fs, efd));
    }
    return result;
  }
}

function joinPathEq(a1: JoinPath, a2: JoinPath): boolean {
  let len = a1.length;
  if (len !== a2.length) {
    return false;
  }
  while (len > 0) {
    len -= 1;
    if (a1[len].name !== a2[len].name) {
      return false;
    }
  }
  return true;
}

function getJoinUsage(fs: FieldSpace, expr: Expr): JoinPath[] {
  const result: JoinPath[] = [];
  const lookupWithPath = (
    fs: FieldSpace,
    path: string[]
  ): {
    fs: FieldSpace;
    def: FieldDef;
    joinPath: JoinPath;
  } => {
    const head = path[0];
    const rest = path.slice(1);
    const def = fs.entry(head);
    if (def === undefined) {
      throw new Error(`Invalid field lookup ${head}`);
    }
    if (def instanceof StructSpaceField && rest.length > 0) {
      const restDef = lookupWithPath(def.fieldSpace, rest);
      return {
        ...restDef,
        joinPath: [{...def.joinPathElement, name: head}, ...restDef.joinPath],
      };
    } else if (def instanceof SpaceField) {
      if (rest.length !== 0) {
        throw new Error(`${head} cannot contain a ${rest.join('.')}`);
      }
      const fieldDef = def.fieldDef();
      if (fieldDef) {
        return {
          fs,
          def: fieldDef,
          joinPath: [],
        };
      }
      throw new Error('No field def');
    } else {
      throw new Error('expected a field def or struct');
    }
  };
  for (const frag of exprWalk(expr)) {
    if (frag.node === 'field') {
      const def = lookupWithPath(fs, frag.path);
      const field = def.def;
      if (isAtomic(field) && !isJoined(field)) {
        if (hasExpression(field)) {
          const defUsage = getJoinUsage(def.fs, field.e);
          result.push(...defUsage.map(r => [...def.joinPath, ...r]));
        } else {
          result.push(def.joinPath);
        }
      }
    } else if (frag.node === 'source-reference') {
      if (frag.path) {
        const def = lookupWithPath(fs, frag.path);
        result.push(def.joinPath);
      } else {
        result.push([]);
      }
    }
  }
  return result;
}

type UsagePathElement = JoinPathElement & {reverse: boolean};
type UsagePath = UsagePathElement[];
function getJoinUsagePaths(
  joinPath: JoinPath,
  joinUsage: JoinPath[]
): UsagePath[] {
  const sourceToUsagePaths: UsagePath[] = [];
  for (const usage of joinUsage) {
    let overlap = 0;
    for (let i = 0; i < joinPath.length && i < usage.length; i++) {
      if (joinPath[i].name === usage[i].name) {
        overlap = i + 1;
      } else {
        break;
      }
    }
    const nonOverlapSource = joinPath.slice(overlap);
    const nonOverlapUsage = usage.slice(overlap);
    const sourceToUsagePath: UsagePath = [
      ...nonOverlapSource.map(r => ({...r, reverse: true})),
      ...nonOverlapUsage.map(r => ({...r, reverse: false})),
    ];
    sourceToUsagePaths.push(sourceToUsagePath);
  }
  return sourceToUsagePaths;
}

function validateUsagePaths(
  functionName: string,
  usagePaths: UsagePath[]
): {message: string; code: MessageCode} | undefined {
  for (const path of usagePaths) {
    for (const step of path) {
      if (step.joinType === 'cross') {
        return {
          code: 'aggregate-traverses-join-cross',
          message: `Cannot compute \`${functionName}\` across \`join_cross\` relationship \`${step.name}\``,
        };
      } else if (step.joinElementType === 'array' && !step.reverse) {
        return {
          code: 'aggregate-traverses-repeated-relationship',
          message: `Cannot compute \`${functionName}\` across repeated relationship \`${step.name}\``,
        };
      } else if (step.joinType === 'many' && !step.reverse) {
        return {
          code: 'aggregate-traverses-join-many',
          message: `Cannot compute \`${functionName}\` across \`join_many\` relationship \`${step.name}\``,
        };
      }
    }
  }
}

function suggestNewVersion(
  joinError: string,
  joinUsage: JoinPath[],
  expr: FieldReference | ExpressionDef,
  func: string
) {
  if (joinUsage.length === 0) {
    return joinError;
  }
  // Get longest shared prefix
  let longestOverlap = joinUsage[0];
  for (const usage of joinUsage.slice(1)) {
    for (let i = 0; i < longestOverlap.length; i++) {
      const a = longestOverlap[i];
      const b = usage[i];
      if (a.name !== b.name) {
        longestOverlap = longestOverlap.slice(0, i);
        break;
      }
    }
  }
  const usagePaths = getJoinUsagePaths(longestOverlap, joinUsage);
  const usageError = validateUsagePaths(func, usagePaths);
  // get rid of everything after the last many/cross
  const indexFromEndOfLastMany = longestOverlap
    .slice()
    .reverse()
    .findIndex(x => x.joinType === 'many' || x.joinType === 'cross');
  const numJoinsToLastMany =
    indexFromEndOfLastMany === -1
      ? 0
      : longestOverlap.length - indexFromEndOfLastMany;
  const shortestOverlapWithMany = longestOverlap.slice(0, numJoinsToLastMany);
  const shortUsagePaths = getJoinUsagePaths(shortestOverlapWithMany, joinUsage);
  const shortUsageError = validateUsagePaths(func, shortUsagePaths);
  const longLocality =
    longestOverlap.length > 0
      ? longestOverlap.map(r => r.name).join('.')
      : 'source';
  const shortLocality =
    shortestOverlapWithMany.length > 0
      ? shortestOverlapWithMany.map(r => r.name).join('.')
      : 'source';
  if (usageError) {
    return 'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`';
  } else {
    const longSuggestion =
      expr instanceof FieldReference
        ? `${expr.refString}.${func}()`
        : expr instanceof ExprIdReference
        ? `${expr.fieldReference.refString}.${func}()`
        : `${longLocality}.${func}(${expr.code})`;
    const shortSuggestion = `${shortLocality}.${func}(${expr.code})`;
    let result = `${joinError}; use \`${longSuggestion}\``;
    if (shortUsageError === undefined && shortLocality !== longLocality) {
      result += ` or \`${shortSuggestion}\` to get a result weighted with respect to \`${shortLocality}\``;
    }
    return result;
  }
}
