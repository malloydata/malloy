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
  AtomicTypeDef,
  EvalSpace,
  expressionIsScalar,
  ExpressionType,
  ExpressionValueType,
  TD,
  TypeDesc,
} from '../../model';

function mkTypeDesc(
  // The problem is that record and array, as currently defined, require a dialect
  // which isn't available. In retrospect the dialect shouldn't be in the type,
  // it should only be in the field, which I wil do eventually.
  dataType: Exclude<ExpressionValueType, 'record' | 'array'>,
  expressionType: ExpressionType = 'scalar',
  evalSpace: EvalSpace = 'constant'
): TypeDesc {
  return {type: dataType, expressionType, evalSpace};
}

const nullT = mkTypeDesc('null');
const numberT = mkTypeDesc('number');
const stringT = mkTypeDesc('string');
const dateT = mkTypeDesc('date');
const timestampT = mkTypeDesc('timestamp');
const boolT = mkTypeDesc('boolean');
const errorT = mkTypeDesc('error');
const viewT = mkTypeDesc('turtle');
/**
 * Collects functions which operate on TypeDesc compatible objects
 * The compiler also has a TD object which works on "TypeDef"
 * compatible objects, which includes TypeDesc.
 */
export const TDU = {
  /**
   * Checks if a given type is in a list
   * @param check The type to check (can be undefined)
   * @param from List of types which are OK
   */
  in(check: TypeDesc | undefined, from: TypeDesc[]): boolean {
    if (check) {
      const found = from.find(okType => TDU.eq(okType, check));
      return found !== undefined;
    }
    return false;
  },

  /**
   * Checks if a possibly undefined candidate matches a type
   * @param good The real type
   * @param checkThis The possibly undefined candidate
   */
  eq(good: TypeDesc, checkThis: TypeDesc | undefined): boolean {
    return (
      checkThis !== undefined &&
      TD.eq(good, checkThis) &&
      good.expressionType === checkThis.expressionType
    );
  },

  /**
   * Checks if a given type is in a list, ignoring aggregate
   * @param check The type to check (can be undefined)
   * @param from List of types which are OK
   */
  typeIn(check: TypeDesc | undefined, from: TypeDesc[]): boolean {
    if (check) {
      const found = from.find(okType => TDU.typeEq(okType, check));
      return found !== undefined;
    }
    return false;
  },

  /**
   * Checks if the base types, ignoring expressionType, are equal
   * @param left Left type
   * @param right Right type
   * @param nullOk True if a NULL is an acceptable match
   */
  typeEq(
    left: TypeDesc,
    right: TypeDesc,
    nullOk = false,
    errorOk = true
  ): boolean {
    const maybeEq = TD.eq(left, right);
    const nullEq = nullOk && (left.type === 'null' || right.type === 'null');
    const errorEq =
      errorOk && (left.type === 'error' || right.type === 'error');
    return maybeEq || nullEq || errorEq;
  },

  /**
   *
   * For error messages, returns a comma seperated list of readable names
   * for a list of types.
   * @param types List of type or objects with types
   */
  inspect(...types: (TypeDesc | undefined)[]): string {
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
  },

  nullT,
  numberT,
  stringT,
  dateT,
  timestampT,
  boolT,
  errorT,
  viewT,
  anyAtomicT: [numberT, stringT, dateT, timestampT, boolT],
  aggregateBoolT: mkTypeDesc('boolean', 'aggregate'),
  make(
    dataType: ExpressionValueType,
    expressionType: ExpressionType = 'scalar',
    evalSpace: EvalSpace = 'constant'
  ): TypeDesc {
    if (dataType === 'record' || dataType === 'array') {
      return {type: 'error', expressionType, evalSpace};
    }
    return {type: dataType, expressionType, evalSpace};
  },
  /**
   * Used when using a TypeDesc or TypeDesc-like interface to
   * create a field, don't copy the non type fields.
   */
  atomicDef(td: AtomicTypeDef | TypeDesc): AtomicTypeDef {
    if (TD.isAtomic(td)) {
      switch (td.type) {
        case 'array': {
          return {
            name: '',
            type: 'array',
            join: 'many',
            elementTypeDef: td.elementTypeDef,
            dialect: td.dialect,
            fields: td.fields,
          };
        }
        case 'record': {
          return {
            name: '',
            type: 'record',
            join: 'one',
            dialect: td.dialect,
            fields: td.fields,
          };
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
  },
};
