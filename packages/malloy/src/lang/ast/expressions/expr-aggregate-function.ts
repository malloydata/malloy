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
    let expr: FieldReference | ExpressionDef | undefined = this.expr;
    let exprVal = this.expr?.getExpression(fs);
    let structPath = this.source?.refString;
    let sourceRelationship: {
      name: string;
      structRelationship: StructRelationship;
    }[] = [];
    const joinUsage = this.getJoinUsage(fs);
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
          structPath = this.source.sourceString;
          if (sourceFoot instanceof ReferenceField && sourceFoot.outputField) {
            // If you reference an output field as the foot, then we need to get the
            // source from that field, rather than using the default source.
            structPath = sourceFoot.fieldRef.sourceString;
          } else {
            // Here we handle a special case where you write `foo.agg()` and `foo` is a
            // dimension which uses only one distinct join path; in this case, we set the
            // locality to be that join path
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
    if (exprVal.evalSpace === 'output') {
      this.log('Aggregate over an output expression is never useful');
    }
    const m4warnings = this.translator()?.root.compilerFlags?.has('m4warnings');
    if (m4warnings) {
      // Did the user spceify a source, either as `source.agg()` or `path.to.join.agg()` or `path.to.field.agg()`
      const sourceSpecified = this.source !== undefined || this.explicitSource;
      if (expr) {
        // Is this an `agg(field)`, where field uses no joins (or nested fields)
        const noJoinField =
          !this.source && joinUsage.every(usage => usage.length === 0);
        if (!noJoinField && !this.isSymmetricFunction()) {
          const usagePaths = getJoinUsagePaths(sourceRelationship, joinUsage);
          const joinError = sourceSpecified
            ? validateUsagePaths(usagePaths)
            : `Explicit aggregate locality is required for asymmetric aggregate ${this.elementType}`;
          const suggestion = suggestNewVersion(
            joinUsage,
            expr,
            this.elementType
          );
          if (joinError) {
            this.log(`${joinError}; ${suggestion}`, 'warn');
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
            // TODO make sure this thing works for dimensions used in dimensions
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

function suggestNewVersion(
  joinUsage: {name: string; structRelationship: StructRelationship}[][],
  expr: FieldReference | ExpressionDef,
  func: string
) {
  if (joinUsage.length === 0) {
    return;
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
  // expr.log(`${joinUsage.map(prettyRelationship)}`);
  const usagePaths = getJoinUsagePaths(longestOverlap, joinUsage);
  // expr.log(`${usagePaths.map(prettyUsagePath)}`);
  const usageError = validateUsagePaths(usagePaths);
  // get rid of everything after the last many/cross
  const indexFromEndOfLastMany = longestOverlap
    .reverse()
    .findIndex(
      x =>
        x.structRelationship.type === 'many' ||
        x.structRelationship.type === 'cross'
    );
  const lastManyCrossIndex =
    indexFromEndOfLastMany === -1
      ? 0
      : longestOverlap.length - indexFromEndOfLastMany;
  const shortestOverlapWithMany = longestOverlap.slice(0, lastManyCrossIndex);
  const shortUsagePaths = getJoinUsagePaths(shortestOverlapWithMany, joinUsage);
  const shortUsageError = validateUsagePaths(shortUsagePaths);
  // const debug = `longest overlap of ${joinUsage.map(
  //   prettyRelationship
  // )} is ${prettyRelationship(longestOverlap)}`;
  const longLocality =
    longestOverlap.length > 0
      ? longestOverlap.map(r => r.name).join('.')
      : 'source';
  const shortLocality =
    shortestOverlapWithMany.length > 0
      ? shortestOverlapWithMany.map(r => r.name).join('.')
      : 'source';
  if (usageError) {
    return 'rewrite';
  } else {
    const longSuggestion =
      expr instanceof FieldReference
        ? `${expr.refString}.${func}()`
        : expr instanceof ExprIdReference
        ? `${expr.fieldReference.refString}.${func}()`
        : `${longLocality}.${func}(${expr.code})`;
    const shortSuggestion = `${shortLocality}.${func}(${expr.code})`;
    // const debug = `shortest overlap with manys: ${prettyRelationship(
    //   shortestOverlapWithMany
    // )} / `;
    let result = `use \`${longSuggestion}\``;
    if (shortUsageError === undefined && shortLocality !== longLocality) {
      result += ` or \`${shortSuggestion}\` to get a result weighted with respect to \`${shortLocality}\``;
    }
    return result;
  }
}

/*

field.agg()
one.field.agg()
many.field.agg()
cross.field.agg()
one.agg(one.field)
many.agg(many.field)
many.agg(one.field)
many.agg(cross.field)

// Forms
// A path.to.field.agg()
// B path.to.join.agg(path.to.field)
// C path.to.join.agg(expr)
// D agg(path.to.field)
// E agg(expr)
// F source.agg(expr)
// G source.agg(path.to.field)

// Classify
// Ok
// Special case: agg(dimension(path.many.path)) -> set the agg locality to path.many.path (the long path)
// Special case: agg(field) -> set the agg locality to source
// Crosses exactly one join_many relationship j forward

    short path: shortest path shared by all usages that contains the problematic many
    long path: longest path shared by all usages (that contains the problematic many)
    theory: for all cases, take the path to the many (short path) and the path to the field (long path), and do the agg WRT each.
    If the path to the field === the path to the many, then there's only one.
    If the arg is a field, then rewrite as path.to.field.agg() OR path.to.many.agg(path.to.field)
    If arg is an expression, then rewrite as short.agg(expr) OR long.agg(expr)

    - always pick the long path
    - if it can be written as field.agg() suggest that
    - for expressions: long.agg(expr)

    What about middle?

  // A: path.many.path.field.agg() -> OK as is
  // B:
    path.agg(path.many.path.field) -> path.many.path.field.agg()
                                   -> path.many.agg(path.many.path.field)
    path.agg(path.many.field) -> path.many.field.agg()
  // C:
    path.agg(expr(path.many.path)) -> path.many.path.agg(expr)
                                   -> path.many.agg(expr)
  // D:
    agg(path.many.path.field) -> path.many.path.field.agg()
      or specify some other locality....
                              -> path.many.agg(path.many.path.field)

                              read more at malloydata.dev/aggregatelocality
    agg(path.many.field) -> roopatht.many.field.agg()
  // E:
    agg(expr(path.many.path)) -> path.many.path.agg(expr) or move the aggregates into the sources
                              -> path.many.agg(expr)
  // F:
    source.agg(expr(path.many.path)) -> path.many.path.agg(expr)
                                     -> path.many.agg(expr)
  // G:
    source.agg(root.many.path.field) -> root.many.path.field.agg()
                                     -> root.many.agg(root.many.path.field)
    source.agg(root.many.field) -> root.many.field.agg()
// Crosses exactly one join_cross relationship j forward ^ same as above
// Crosses exactly one join_cross relationship backward
  // B: cross.agg(one.field) ; suggest one.field.agg() or source.agg(one.field)
  // C: Invalid, needs to be rewritten
// Using no many or cross:
   agg(path.field) -> path.field.agg() "you probably mean this"
                   -> source.agg(path.field) "this is also valid but gives a weighted result"

// Any other combination of things: rewrite






*/
