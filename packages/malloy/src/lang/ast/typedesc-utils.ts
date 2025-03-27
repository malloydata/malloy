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
  AtomicTypeDef,
  EvalSpace,
  ExpressionType,
  ExpressionValueType,
  TypeDesc,
} from '../../model';
import {expressionIsScalar, isRepeatedRecord, TD} from '../../model';
import {emptyCompositeFieldUsage} from '../../model/composite_source_utils';

function mkTypeDesc(
  // The problem is that record and array, as currently defined, require a dialect
  // which isn't available. In retrospect the dialect shouldn't be in the type,
  // it should only be in the field, which I wil do eventually.
  dataType: Exclude<ExpressionValueType, 'record' | 'array'>,
  expressionType: ExpressionType = 'scalar',
  evalSpace: EvalSpace = 'constant'
): TypeDesc {
  return {
    type: dataType,
    expressionType,
    evalSpace,
    compositeFieldUsage: emptyCompositeFieldUsage(),
  };
}

export const nullT = mkTypeDesc('null');
export const numberT = mkTypeDesc('number');
export const stringT = mkTypeDesc('string');
export const dateT = mkTypeDesc('date');
export const timestampT = mkTypeDesc('timestamp');
export const boolT = mkTypeDesc('boolean');
export const errorT = mkTypeDesc('error');
export const viewT = mkTypeDesc('turtle');
export const aggregateBoolT = mkTypeDesc('boolean', 'aggregate');
export const anyAtomicT = [numberT, stringT, dateT, timestampT, boolT];

/**
 * Checks if a given type is in a list
 * @param check The type to check (can be undefined)
 * @param from List of types which are OK
 */
export function any(check: TypeDesc | undefined, from: TypeDesc[]): boolean {
  if (check) {
    const found = from.find(okType => eq(okType, check));
    return found !== undefined;
  }
  return false;
}

/**
 * Checks if a possibly undefined candidate matches a type
 * @param good The real type
 * @param checkThis The possibly undefined candidate
 */
export function eq(good: TypeDesc, checkThis: TypeDesc | undefined): boolean {
  return (
    checkThis !== undefined &&
    TD.eq(good, checkThis) &&
    good.expressionType === checkThis.expressionType
  );
}

/**
 * Checks if a given type is in a list, ignoring aggregate
 * @param check The type to check (can be undefined)
 * @param from List of types which are OK
 */
export function typeIn(check: TypeDesc | undefined, from: TypeDesc[]): boolean {
  if (check) {
    const found = from.find(okType => typeEq(okType, check));
    return found !== undefined;
  }
  return false;
}

/**
 * Checks if the base types, ignoring expressionType, are equal
 * @param left Left type
 * @param right Right type
 * @param nullOk True if a NULL is an acceptable match
 */
export function typeEq(
  left: TypeDesc,
  right: TypeDesc,
  nullOk = false,
  errorOk = true
): boolean {
  const maybeEq = TD.eq(left, right);
  const nullEq = nullOk && (left.type === 'null' || right.type === 'null');
  const errorEq = errorOk && (left.type === 'error' || right.type === 'error');
  return maybeEq || nullEq || errorEq;
}

/**
 *
 * For error messages, returns a comma seperated list of readable names
 * for a list of types.
 * @param types List of type or objects with types
 */
export function inspect(...types: (TypeDesc | undefined)[]): string {
  const strings = types.map(type => {
    if (type) {
      let inspected: string = type.type;
      if (!expressionIsScalar(type.expressionType)) {
        inspected = `${type.expressionType} ${inspected}`;
      }
      return inspected;
    }
    return 'undefined';
  });
  return strings.join(',');
}

/**
 * Used when using a TypeDesc or TypeDesc-like interface to
 * create a field, don't copy the non type fields.
 */
export function atomicDef(td: AtomicTypeDef | TypeDesc): AtomicTypeDef {
  if (TD.isAtomic(td)) {
    switch (td.type) {
      case 'array': {
        return isRepeatedRecord(td)
          ? {
              type: 'array',
              elementTypeDef: td.elementTypeDef,
              fields: td.fields,
            }
          : {
              type: 'array',
              elementTypeDef: td.elementTypeDef,
            };
      }
      case 'record': {
        return {type: 'record', fields: td.fields};
      }
      case 'number': {
        return td.numberType
          ? {type: 'number', numberType: td.numberType}
          : {type: 'number'};
      }
      case 'sql native': {
        return td.rawType
          ? {type: 'sql native', rawType: td.rawType}
          : {type: 'sql native'};
      }
      default:
        return {type: td.type};
    }
  }
  return {type: 'error'};
}
