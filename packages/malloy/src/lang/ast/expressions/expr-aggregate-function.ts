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
import {ReferenceField} from '../field-space/reference-field';
import {StructSpaceField} from '../field-space/static-space';
import {StructSpaceFieldBase} from '../field-space/struct-space-field-base';
import {FT} from '../fragtype-utils';
import {FieldReference} from '../query-items/field-references';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {SpaceField} from '../types/space-field';

export abstract class ExprAggregateFunction extends ExpressionDef {
  elementType: string;
  source?: FieldReference;
  expr?: ExpressionDef;
  legalChildTypes = [FT.numberT];
  constructor(readonly func: string, expr?: ExpressionDef) {
    super();
    this.elementType = func;
    if (expr) {
      this.expr = expr;
      this.has({expr: expr});
    }
  }

  returns(_forExpression: ExprValue): FieldValueType {
    return 'number';
  }

  getExpression(fs: FieldSpace): ExprValue {
    let expr: FieldReference | ExpressionDef | undefined = this.expr;
    let exprVal = this.expr?.getExpression(fs);
    let structPath = this.source?.refString;
    let sourceRelationship: {
      name: string;
      structRelationship: StructRelationship;
    }[] = [];
    if (this.source) {
      const result = this.source.getField(fs);
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
          // If you reference an output field as the foot, then we need to get the
          // source from that field, rather than using the default source.
          if (sourceFoot.outputField && sourceFoot instanceof ReferenceField) {
            structPath = sourceFoot.fieldRef.sourceString;
          } else {
            structPath = this.source.sourceString;
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
    if (exprVal.evalSpace === 'output') {
      this.log('Aggregate over an output expression is never useful');
    }
    if (expressionIsAggregate(exprVal.expressionType)) {
      this.log('Aggregate expression cannot be aggregate');
      return errorFor('reagggregate');
    }
    if (expr) {
      const usagePaths = getJoinUsagePaths(
        sourceRelationship,
        this.getJoinUsage(fs)
      );
      // TODO only do this for asymmetric aggregates...
      // TODO joinUsage is wrong for non-column dimensions that use joins...
      const joinError = validateUsagePaths(usagePaths);
      if (joinError) {
        this.log(joinError, 'warn');
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

  getJoinUsage(fs: FieldSpace) {
    const result: {name: string; structRelationship: StructRelationship}[][] =
      [];
    if (this.source) {
      const lookup = this.source.getField(fs);
      if (lookup.found) {
        // TODO uhhhh
        if (lookup.found.outputField) {
          const sfd: Fragment[] = [
            {type: 'outputField', name: this.source.refString},
          ];
          result.push(...getJoinUsage(fs, sfd));
        } else {
          const sfd: Fragment[] = [
            {type: 'field', path: this.source.refString},
          ];
          result.push(...getJoinUsage(fs, sfd));
        }
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
    // TODO sources as fields?
    if (typeof frag !== 'string') {
      if (frag.type === 'field' || frag.type === 'outputField') {
        const path = frag.type === 'field' ? frag.path : frag.name;
        const def = lookup(fs, path);
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

function prettyRelationship(
  relationship: {name: string; structRelationship: StructRelationship}[]
): string {
  return relationship
    .map(p => `${p.name}[${p.structRelationship.type}]`)
    .join('.');
}

function prettyUsagePath(
  relationship: {
    name: string;
    structRelationship: StructRelationship;
    reverse: boolean;
  }[]
): string {
  return relationship
    .map(
      p => `${p.name}[${p.reverse ? '<<' : '>>'}${p.structRelationship.type}]`
    )
    .join('.');
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
  usagePaths: {
    name: string;
    structRelationship: StructRelationship;
    reverse: boolean;
  }[][]
) {
  for (const path of usagePaths) {
    for (const step of path) {
      if (step.structRelationship.type === 'cross') {
        return `Cannot compute asymmetric aggregate across join_cross relationship \`${step.name}\``;
      } else if (step.structRelationship.type === 'many' && !step.reverse) {
        return `Cannot compute asymmetric aggregate across forward join_many relationship \`${step.name}\``;
      }
    }
  }
}
