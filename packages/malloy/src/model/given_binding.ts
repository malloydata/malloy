/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DateTime} from 'luxon';
import {closestMatch} from '../util/closest_match';
import {isRepeatedRecord, mkSafeRecord, TD} from './malloy_types';
import type {
  AtomicTypeDef,
  Expr,
  GivenID,
  GivenTypeDef,
  GivenValue,
  ModelDef,
  SafeRecord,
} from './malloy_types';

export function resolveSuppliedGivens(
  supplied: Record<string, GivenValue> | undefined,
  modelDef: ModelDef | undefined
): Map<GivenID, Expr> {
  const out = new Map<GivenID, Expr>();
  if (!supplied || !modelDef) return out;
  const givens = modelDef.givens ?? {};
  // Object.entries skips inherited properties — protects against
  // prototype pollution from e.g. an Object.create(...)-derived input.
  for (const [name, value] of Object.entries(supplied)) {
    if (value === undefined) {
      throw new Error(
        `givens.${name}: explicit undefined is not a valid value. ` +
          'Omit the key to defer to declaration default or a lower supply ' +
          'layer; use null for an explicit null value.'
      );
    }
    const entry = modelDef.contents[name];
    if (!entry || entry.type !== 'given') {
      const surfaceNames: string[] = [];
      for (const [k, v] of Object.entries(modelDef.contents)) {
        if (v.type === 'given') surfaceNames.push(k);
      }
      const suggestion = closestMatch(name, surfaceNames);
      const hint = suggestion ? ` (did you mean '${suggestion}'?)` : '';
      throw new Error(
        `givens: unknown given '${name}'${hint}. Model surfaces [${surfaceNames.join(', ')}]`
      );
    }
    const decl = givens[entry.id];
    if (!decl) {
      // The namespace entry should never out-live its declaration — if it
      // does, that's a translator bug, not a caller error.
      throw new Error(
        `givens: internal error: namespace entry '${name}' has no declaration. Likely a compiler bug.`
      );
    }
    out.set(entry.id, valueToExpr(name, decl.type, value));
  }
  return out;
}

function valueToExpr(
  path: string,
  type: GivenTypeDef,
  value: GivenValue
): Expr {
  if (value === null) {
    return {node: 'null'};
  }
  switch (type.type) {
    case 'string': {
      if (typeof value !== 'string') {
        throw new TypeError(
          `givens.${path}: expected string, got ${describeJs(value)}`
        );
      }
      return {node: 'stringLiteral', literal: value};
    }
    case 'number': {
      let lit: string;
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          throw new TypeError(
            `givens.${path}: number must be finite, got ${value}`
          );
        }
        lit = String(value);
      } else if (typeof value === 'bigint') {
        lit = value.toString();
      } else if (typeof value === 'string') {
        if (!/^-?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(value)) {
          throw new TypeError(
            `givens.${path}: number-as-string must be numeric, got '${value}'`
          );
        }
        lit = value;
      } else {
        throw new TypeError(
          `givens.${path}: expected number | bigint | string, got ${describeJs(value)}`
        );
      }
      return {node: 'numberLiteral', literal: lit};
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        throw new TypeError(
          `givens.${path}: expected boolean, got ${describeJs(value)}`
        );
      }
      return {node: value ? 'true' : 'false'};
    }
    case 'date': {
      if (typeof value !== 'string') {
        throw new TypeError(
          `givens.${path}: expected ISO date string 'YYYY-MM-DD', got ${describeJs(value)}`
        );
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new TypeError(
          `givens.${path}: date must match 'YYYY-MM-DD', got '${value}'`
        );
      }
      return {node: 'dateLiteral', literal: value, typeDef: {type: 'date'}};
    }
    case 'timestamp': {
      // Naive timestamp: wall-clock value with no offset. Reject JS Date
      // (it's a UTC instant — wrong shape) and reject offset-bearing
      // strings (those want 'timestamptz'). Parse the rest with Luxon and
      // emit canonical "YYYY-MM-DD HH:MM:SS.sss" for the dialect.
      if (typeof value !== 'string') {
        throw new TypeError(
          `givens.${path}: expected ISO timestamp string (no offset), got ${describeJs(value)}`
        );
      }
      if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
        throw new TypeError(
          `givens.${path}: 'timestamp' is naive — use 'timestamptz' for offset/zoned values, got '${value}'`
        );
      }
      // ISO uses T-separator; SQL form uses space. Accept both.
      let dt = DateTime.fromISO(value, {zone: 'utc'});
      if (!dt.isValid) dt = DateTime.fromSQL(value, {zone: 'utc'});
      if (!dt.isValid) {
        throw new TypeError(
          `givens.${path}: invalid timestamp value '${value}': ${dt.invalidReason ?? 'unknown'}`
        );
      }
      return {
        node: 'timestampLiteral',
        literal: dt.toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
        typeDef: {type: 'timestamp'},
      };
    }
    case 'timestamptz': {
      let dt: DateTime;
      if (value instanceof Date) {
        dt = DateTime.fromJSDate(value, {zone: 'utc'});
      } else if (typeof value === 'string') {
        dt = DateTime.fromISO(value, {setZone: true});
        if (dt.isValid) dt = dt.toUTC();
      } else {
        throw new TypeError(
          `givens.${path}: expected JS Date or ISO timestamptz string, got ${describeJs(value)}`
        );
      }
      if (!dt.isValid) {
        throw new TypeError(
          `givens.${path}: invalid timestamptz value '${value}': ${dt.invalidReason ?? 'unknown'}`
        );
      }
      return {
        node: 'timestamptzLiteral',
        literal: dt.toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
        typeDef: {type: 'timestamptz'},
        timezone: 'UTC',
      };
    }
    case 'filter expression': {
      if (typeof value !== 'string') {
        throw new TypeError(
          `givens.${path}: filter<T> givens require a JS string of Malloy filter source, got ${describeJs(value)}`
        );
      }
      return {node: 'filterLiteral', filterSrc: value};
    }
    case 'array': {
      if (!Array.isArray(value)) {
        throw new TypeError(
          `givens.${path}: expected array, got ${describeJs(value)}`
        );
      }
      // RepeatedRecord (array of records) carries `record_element` as its
      // element type and the record's schema in `fields`. Each element is
      // a record of that schema. BasicArray carries a non-record element
      // type directly.
      const elemType: AtomicTypeDef = isRepeatedRecord(type)
        ? {type: 'record', fields: type.fields}
        : type.elementTypeDef;
      const values = value.map((el, i) =>
        valueToExpr(`${path}[${i}]`, elemType, el)
      );
      return {node: 'arrayLiteral', kids: {values}, typeDef: type};
    }
    case 'record': {
      if (
        typeof value !== 'object' ||
        Array.isArray(value) ||
        value instanceof Date
      ) {
        throw new TypeError(
          `givens.${path}: expected object, got ${describeJs(value)}`
        );
      }
      const obj = value;
      const declared = new Set(type.fields.map(f => f.name));
      for (const k of Object.keys(obj)) {
        if (!declared.has(k)) {
          throw new TypeError(
            `givens.${path}.${k}: unexpected key (not in record type [${[...declared].join(', ')}])`
          );
        }
      }
      const kids: SafeRecord<Expr> = mkSafeRecord();
      for (const field of type.fields) {
        if (!(field.name in obj)) {
          throw new TypeError(
            `givens.${path}.${field.name}: missing required key`
          );
        }
        kids[field.name] = valueToExpr(
          `${path}.${field.name}`,
          TD.atomicDef(field),
          obj[field.name]
        );
      }
      return {node: 'recordLiteral', kids, typeDef: type};
    }
    case 'json':
    case 'sql native':
    case 'error':
      throw new Error(`givens.${path}: type '${type.type}' is not bindable`);
    default: {
      // Exhaustiveness: future GivenTypeDef additions will trip this.
      const _x: never = type;
      throw new Error(
        `givens.${path}: unhandled given type ${JSON.stringify(_x)}`
      );
    }
  }
}

function describeJs(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'Date';
  return typeof value;
}
