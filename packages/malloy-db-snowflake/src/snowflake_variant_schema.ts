/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Infers Malloy types for Snowflake VARIANT / ARRAY / OBJECT columns from
// sampled (path, type) evidence in two phases:
//
//   1. Accumulate. Each sampled path implies a shape for every one of its
//      prefixes (a `.field` step implies the parent is an object; a `[*]`
//      step implies an array; the terminal step is a leaf of the observed
//      SQL type). `VariantSchemaState` stores a `shapes` map keyed by
//      prefix and a `children` adjacency map. `seedTopLevelShape` pre-seeds
//      top-level ARRAY/OBJECT from DESCRIBE as authoritative — sample rows
//      cannot override those shapes.
//   2. Build. `buildTopLevelField` walks the accumulated state and emits a
//      Malloy `FieldDef`. Any prefix whose shape is `variant` (or absent)
//      degrades locally to `sql native` variant; stable siblings are kept.
//
// Vocabulary: `Segment` is one step in a path; `Shape` is what we've
// concluded a prefix must be (`object | array | leaf | variant`, where
// `variant` is the absorbing state); `VariantSchemaState` is the whole
// accumulator. All consistency decisions flow through `mergeShape`.
//
// Snowflake-specific invariant: path access on a VARIANT whose actual
// value doesn't match the path returns NULL rather than raising. That is
// what makes reconstructing an object shape from descendant-only evidence
// safe here — rows where the parent is a scalar still evaluate cleanly
// against the inferred record schema. This assumption is not portable to
// dialects that error on incompatible path access.

import type {AtomicTypeDef, Dialect, FieldDef} from '@malloydata/malloy';
import {
  TinyParser,
  mkArrayTypeDef,
  mkFieldDef,
  pathToKey,
} from '@malloydata/malloy/internal';

export type NestedColumnKind = 'variant' | 'array' | 'object';

export interface NestedColumn {
  kind: NestedColumnKind;
  name: string;
}

export type Segment = {kind: 'name'; name: string} | {kind: 'array'};

export type Shape =
  | {kind: 'object'}
  | {kind: 'array'}
  | {kind: 'leaf'; type: string}
  | {kind: 'variant'};

export type PrefixKey = string;

export interface Children {
  elem?: PrefixKey;
  named: Map<string, PrefixKey>;
}

export interface VariantSchemaState {
  children: Map<PrefixKey, Children>;
  seededTopLevels: Set<PrefixKey>;
  shapes: Map<PrefixKey, Shape>;
}

export class PathParser extends TinyParser {
  constructor(pathName: string) {
    super(pathName, {
      quoted: /^'(\\'|[^'])*'/,
      array_of: /^\[\*]/,
      char: /^[[.\]]/,
      number: /^\d+/,
      word: /^\w+/,
    });
  }

  getName() {
    const word = this.match('word');
    if (word) return word.text;
    if (this.match('[')) {
      const quotedName = this.expect('quoted');
      this.expect(']');
      return quotedName.text;
    }
    throw this.parseError('Expected column name');
  }

  segments(): Segment[] {
    const segments: Segment[] = [{kind: 'name', name: this.getName()}];
    while (!this.eof()) {
      if (this.match('.')) {
        segments.push({kind: 'name', name: this.expect('word').text});
      } else if (this.match('array_of')) {
        segments.push({kind: 'array'});
      } else if (this.match('[')) {
        const quoted = this.expect('quoted');
        this.expect(']');
        segments.push({kind: 'name', name: quoted.text});
      } else {
        throw this.parseError(`Unexpected ${this.peek().type}`);
      }
    }
    return segments;
  }
}

export function createVariantSchemaState(): VariantSchemaState {
  return {
    children: new Map(),
    seededTopLevels: new Set(),
    shapes: new Map(),
  };
}

// The single consistency-policy point: any shape conflict across samples
// collapses to `variant`, and `variant` is absorbing (monotonic).
export function mergeShape(
  existing: Shape | undefined,
  incoming: Shape
): Shape {
  if (existing === undefined) {
    return incoming;
  }
  if (existing.kind === 'variant' || incoming.kind === 'variant') {
    return {kind: 'variant'};
  }
  if (existing.kind !== incoming.kind) {
    return {kind: 'variant'};
  }
  if (
    existing.kind === 'leaf' &&
    incoming.kind === 'leaf' &&
    existing.type !== incoming.type
  ) {
    return {kind: 'variant'};
  }
  return existing;
}

export function seedTopLevelShape(
  state: VariantSchemaState,
  nestedColumn: NestedColumn
): void {
  const key = prefixKey([{kind: 'name', name: nestedColumn.name}]);
  if (nestedColumn.kind === 'array' || nestedColumn.kind === 'object') {
    state.seededTopLevels.add(key);
    state.shapes.set(key, {kind: nestedColumn.kind});
  }
}

export function accumulateVariantPath(
  state: VariantSchemaState,
  segments: Segment[],
  fieldType: string
): void {
  if (segments.length === 0) {
    return;
  }
  const topLevelKey = prefixKey(segments.slice(0, 1));
  const topLevelShape = state.shapes.get(topLevelKey);
  const topLevelIncoming =
    segments.length === 1
      ? observedTypeToShape(fieldType)
      : nextSegmentToShape(segments[1]);
  if (
    state.seededTopLevels.has(topLevelKey) &&
    topLevelShape &&
    (topLevelShape.kind === 'array' || topLevelShape.kind === 'object') &&
    topLevelShape.kind !== topLevelIncoming.kind
  ) {
    // Rule 1: top-level ARRAY/OBJECT from DESCRIBE are authoritative.
    // Ignore impossible sample rows rather than letting them override the seed.
    return;
  }
  let parentKey: PrefixKey | undefined;
  for (let i = 0; i < segments.length; i++) {
    const prefixSegments = segments.slice(0, i + 1);
    const key = prefixKey(prefixSegments);
    const impliedShape =
      i === segments.length - 1
        ? observedTypeToShape(fieldType)
        : nextSegmentToShape(segments[i + 1]);
    state.shapes.set(key, mergeShape(state.shapes.get(key), impliedShape));
    if (parentKey !== undefined) {
      recordChild(state, parentKey, segments[i], key);
    }
    parentKey = key;
  }
}

export function buildTopLevelField(
  nestedColumn: NestedColumn,
  state: VariantSchemaState,
  dialect: Dialect
): FieldDef {
  // Snowflake nested-schema inference follows these rules:
  // - top-level ARRAY/OBJECT from DESCRIBE are authoritative
  // - descendant paths imply ancestor shape
  // - conflicting shapes degrade only that prefix to variant
  // - every top-level nested column still produces a field
  //
  // Snowflake-specific semantic note: reconstructing object shape from
  // descendant paths is safe because path access on an incompatible VARIANT
  // value yields NULL rather than raising an error.
  const key = prefixKey([{kind: 'name', name: nestedColumn.name}]);
  const shape = state.shapes.get(key);
  if (shape === undefined) {
    // Top-level ARRAY with no usable descendants still stays queryable as
    // array<variant>; top-level OBJECT/VARIANT degrades to opaque variant.
    return mkFieldDef(
      nestedColumn.kind === 'array'
        ? mkArrayTypeDef(opaqueVariantType())
        : opaqueVariantType(),
      nestedColumn.name
    );
  }
  return mkFieldDef(buildTypeForKey(key, state, dialect), nestedColumn.name);
}

function buildTypeForKey(
  key: PrefixKey,
  state: VariantSchemaState,
  dialect: Dialect
): AtomicTypeDef {
  const shape = state.shapes.get(key);
  if (shape === undefined || shape.kind === 'variant') {
    return opaqueVariantType();
  }
  if (shape.kind === 'leaf') {
    return dialect.sqlTypeToMalloyType(shape.type);
  }
  if (shape.kind === 'object') {
    const namedChildren = state.children.get(key)?.named;
    if (!namedChildren || namedChildren.size === 0) {
      return opaqueVariantType();
    }
    return {
      type: 'record',
      fields: [...namedChildren.entries()].map(([childName, childKey]) =>
        mkFieldDef(buildTypeForKey(childKey, state, dialect), childName)
      ),
    };
  }
  const elemKey = state.children.get(key)?.elem;
  const elementType = elemKey
    ? buildTypeForKey(elemKey, state, dialect)
    : opaqueVariantType();
  return mkArrayTypeDef(elementType);
}

function nextSegmentToShape(segment: Segment): Shape {
  return segment.kind === 'array' ? {kind: 'array'} : {kind: 'object'};
}

function observedTypeToShape(fieldType: string): Shape {
  // Defensive: production callers only pass Snowflake TYPEOF() results, which
  // are expected to be array/object or scalar leaf types, not "variant".
  if (
    fieldType === 'array' ||
    fieldType === 'object' ||
    fieldType === 'variant'
  ) {
    return {kind: fieldType};
  }
  return {kind: 'leaf', type: fieldType};
}

function recordChild(
  state: VariantSchemaState,
  parentKey: PrefixKey,
  segment: Segment,
  childKey: PrefixKey
): void {
  let children = state.children.get(parentKey);
  if (children === undefined) {
    children = {named: new Map()};
    state.children.set(parentKey, children);
  }
  if (segment.kind === 'array') {
    children.elem = childKey;
  } else {
    children.named.set(segment.name, childKey);
  }
}

function opaqueVariantType(): AtomicTypeDef {
  return {type: 'sql native', rawType: 'variant'};
}

function prefixKey(segments: Segment[]): PrefixKey {
  const [first, ...rest] = segments;
  if (first?.kind !== 'name') {
    throw new Error('Snowflake schema path must start with a named segment');
  }
  return pathToKey(
    first.name,
    rest.map(segment => (segment.kind === 'array' ? '[*]' : segment.name))
  );
}
