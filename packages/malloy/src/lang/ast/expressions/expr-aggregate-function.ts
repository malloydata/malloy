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

import {
  AggregateFragment,
  expressionIsAggregate,
  FieldDef,
  FieldValueType,
  Fragment,
  isAtomicFieldType,
  StructRelationship,
} from '../../../model/malloy_types';
import {exprWalk} from '../../../model/utils';

import {errorFor} from '../ast-utils';
import {StructSpaceField} from '../field-space/static-space';
import {StructSpaceFieldBase} from '../field-space/struct-space-field-base';
import {FT} from '../fragtype-utils';
import {FieldReference} from '../query-items/field-references';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {SpaceField} from '../types/space-field';
import {ExprIdReference} from './expr-id-reference';

export abstract class ExprAggregateFunction extends ExpressionDef {
  elementType: string;
  source?: FieldReference;
  expr?: ExpressionDef;
  explicitSource?: boolean;
  legalChildTypes = [FT.numberT];
  constructor(
    readonly func: string,
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

  returns(_forExpression: ExprValue): FieldValueType {
    return 'number';
  }

  getExpression(fs: FieldSpace): ExprValue {
    // It is never useful to use output fields in an aggregate expression
    // so we don't even allow them to be referenced at all
    const inputFS = fs.isQueryFieldSpace() ? fs.inputSpace() : fs;
    let expr: FieldReference | ExpressionDef | undefined = this.expr;
    let exprVal = this.expr?.getExpression(inputFS);
    let structPath = this.source?.refString;
    let sourceRelationship: {
      name: string;
      structRelationship: StructRelationship;
    }[] = [];
    if (this.source) {
      const result = this.source.getField(inputFS);
      if (result.found) {
        sourceRelationship = result.relationship;
        const sourceFoot = result.found;
        const footType = sourceFoot.typeDesc();
        if (isAtomicFieldType(footType.dataType)) {
          expr = this.source;
          exprVal = {
            dataType: footType.dataType,
            expressionType: footType.expressionType,
            value: [
              footType.evalSpace === 'output'
                ? {
                    type: 'outputField',
                    name: this.source.refString,
                  }
                : {
                    type: 'field',
                    path: this.source.refString,
                  },
            ],
            evalSpace: footType.evalSpace,
          };
          structPath = this.source.sourceString;
          // Here we handle a special case where you write `foo.agg()` and `foo` is a
          // dimension which uses only one distinct join path; in this case, we set the
          // locality to be that join path
          const joinUsage = this.getJoinUsage(inputFS);
          const allUsagePaths = joinUsage.map(x =>
            x.map(y => y.name).join('.')
          );
          const allUsagesSame =
            allUsagePaths.length > 0 &&
            allUsagePaths.slice(1).every(x => x === allUsagePaths[0]);
          if (allUsagesSame) {
            structPath = allUsagePaths[0];
            sourceRelationship = joinUsage[0];
          }
        } else {
          if (!(sourceFoot instanceof StructSpaceFieldBase)) {
            this.log(`Aggregate source cannot be a ${footType.dataType}`);
            return errorFor(
              `Aggregate source cannot be a ${footType.dataType}`
            );
          }
        }
      } else {
        this.log(`Reference to undefined value ${this.source.refString}`);
        return errorFor(
          `Reference to undefined value ${this.source.refString}`
        );
      }
    }
    if (exprVal === undefined) {
      this.log('Missing expression for aggregate function');
      return errorFor('agggregate without expression');
    }
    if (expressionIsAggregate(exprVal.expressionType)) {
      this.log('Aggregate expression cannot be aggregate');
      return errorFor('reagggregate');
    }
    const isAnError = exprVal.dataType === 'error';
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
            ? joinError
            : 'Join path is required for this calculation';
          if (message) {
            const errorWithSuggestion = suggestNewVersion(
              message,
              joinUsage,
              expr,
              this.elementType
            );
            this.log(errorWithSuggestion, joinError ? 'error' : 'warn');
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
      const f: AggregateFragment = {
        type: 'aggregate',
        function: this.func,
        e: exprVal.value,
      };
      if (structPath) {
        f.structPath = structPath;
      }
      return {
        dataType: this.returns(exprVal),
        expressionType: 'aggregate',
        value: [f],
        evalSpace: 'output',
      };
    }
    return errorFor('aggregate type check');
  }

  isSymmetricFunction() {
    return true;
  }

  getJoinUsage(fs: FieldSpace) {
    const result: {name: string; structRelationship: StructRelationship}[][] =
      [];
    if (this.source) {
      const lookup = this.source.getField(fs);
      if (lookup.found) {
        const sfd: Fragment[] = [{type: 'field', path: this.source.refString}];
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

function getJoinUsage(
  fs: FieldSpace,
  expr: Fragment[]
): {name: string; structRelationship: StructRelationship}[][] {
  const result: {name: string; structRelationship: StructRelationship}[][] = [];
  const lookup = (
    fs: FieldSpace,
    path: string
  ): {
    fs: FieldSpace;
    def: FieldDef;
    relationship: {name: string; structRelationship: StructRelationship}[];
  } => {
    const parts = path.split('.');
    const head = parts[0];
    const rest = parts.slice(1);
    const def = fs.entry(head);
    if (def === undefined) {
      throw new Error(`Invalid field lookup ${head}`);
    }
    if (def instanceof StructSpaceField && rest.length > 0) {
      const restDef = lookup(def.fieldSpace, rest.join('.'));
      return {
        ...restDef,
        relationship: [
          {name: head, structRelationship: def.structRelationship},
          ...restDef.relationship,
        ],
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
          relationship: [],
        };
      }
      throw new Error('No field def');
    } else {
      throw new Error('expected a field def or struct');
    }
  };
  exprWalk(expr, frag => {
    if (typeof frag !== 'string') {
      if (frag.type === 'field') {
        const def = lookup(fs, frag.path);
        if (def.def.type !== 'struct' && def.def.type !== 'turtle') {
          if (def.def.e) {
            const defUsage = getJoinUsage(def.fs, def.def.e);
            result.push(...defUsage.map(r => [...def.relationship, ...r]));
          } else {
            result.push(def.relationship);
          }
        }
      }
    }
  });
  return result;
}

function getJoinUsagePaths(
  sourceRelationship: {name: string; structRelationship: StructRelationship}[],
  joinUsage: {name: string; structRelationship: StructRelationship}[][]
): {
  name: string;
  structRelationship: StructRelationship;
  reverse: boolean;
}[][] {
  const sourceToUsagePaths: {
    name: string;
    structRelationship: StructRelationship;
    reverse: boolean;
  }[][] = [];
  for (const usage of joinUsage) {
    let overlap = 0;
    for (let i = 0; i < sourceRelationship.length && i < usage.length; i++) {
      if (sourceRelationship[i].name === usage[i].name) {
        overlap = i + 1;
      } else {
        break;
      }
    }
    const nonOverlapSource = sourceRelationship.slice(overlap);
    const nonOverlapUsage = usage.slice(overlap);
    const sourceToUsagePath: {
      name: string;
      structRelationship: StructRelationship;
      reverse: boolean;
    }[] = [
      ...nonOverlapSource.map(r => ({...r, reverse: true})),
      ...nonOverlapUsage.map(r => ({...r, reverse: false})),
    ];
    sourceToUsagePaths.push(sourceToUsagePath);
  }
  return sourceToUsagePaths;
}

function validateUsagePaths(
  functionName: string,
  usagePaths: {
    name: string;
    structRelationship: StructRelationship;
    reverse: boolean;
  }[][]
) {
  for (const path of usagePaths) {
    for (const step of path) {
      if (step.structRelationship.type === 'cross') {
        return `Cannot compute \`${functionName}\` across \`join_cross\` relationship \`${step.name}\``;
      } else if (step.structRelationship.type === 'many' && !step.reverse) {
        return `Cannot compute \`${functionName}\` across \`join_many\` relationship \`${step.name}\``;
      } else if (step.structRelationship.type === 'nested' && !step.reverse) {
        return `Cannot compute \`${functionName}\` across repeated relationship \`${step.name}\``;
      }
    }
  }
}

function suggestNewVersion(
  joinError: string,
  joinUsage: {name: string; structRelationship: StructRelationship}[][],
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
    .findIndex(
      x =>
        x.structRelationship.type === 'many' ||
        x.structRelationship.type === 'cross'
    );
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
