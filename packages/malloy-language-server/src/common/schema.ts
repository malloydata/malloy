/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AtomicTypeDef,
  Explore,
  Field,
  ModelDef,
  RepeatedRecordTypeDef,
  StructDef,
} from '@malloydata/malloy';
import {JoinRelationship, isSourceDef} from '@malloydata/malloy';

export function isFieldAggregate(field: Field) {
  return field.isAtomicField() && field.isCalculation();
}

export function fieldType(field: Field) {
  if (field.isExplore()) {
    if (field.isArray) {
      return 'array';
    } else {
      return exploreSubtype(field);
    }
  } else {
    return field.isAtomicField() ? field.type.toString() : 'query';
  }
}

export function exploreSubtype(explore: Explore) {
  let subtype;
  if (explore.hasParentExplore()) {
    const relationship = explore.joinRelationship;
    subtype =
      relationship === JoinRelationship.ManyToOne
        ? 'many_to_one'
        : relationship === JoinRelationship.OneToMany
          ? 'one_to_many'
          : JoinRelationship.OneToOne
            ? 'one_to_one'
            : 'base';
  } else {
    subtype = 'base';
  }
  return subtype;
}

/**
 * Cache of compiled field hiding patterns so that for a given schema
 * view render, the pattern only needs to be compiled once. Uses a WeakMap
 * because the Explore object is typically re-created for each render.
 */
const hiddenFields = new WeakMap<
  Explore,
  {strings: string[]; pattern?: RegExp}
>();

/**
 * Guard created because TypeScript wasn't simply treating
 * `typeof tag === 'string` as a sufficient guard in filter()
 *
 * @param tag string | undefined
 * @returns true if tag is a string
 */
const isStringTag = (tag: string | undefined): tag is string =>
  typeof tag === 'string';

/**
 * Determine whether to hide a field in the schema viewer based on tags
 * applied to the source.
 *
 * `hidden = ["field1", "field2"]` will hide individual fields
 * `hidden.pattern = "^_"` will hide fields that match the regular expression
 * /^_/. They can be combined.
 *
 * @param field A Field object
 * @returns true if field should not be displayed in schema viewer
 */
export function isFieldHidden(field: Field): boolean {
  const {name, parentExplore} = field;
  let hidden = hiddenFields.get(parentExplore);
  if (!hidden) {
    const {tag} = parentExplore.tagParse();
    const strings =
      tag
        .array('hidden')
        ?.map(tag => tag.text())
        .filter(isStringTag) || [];

    const patternText = tag.text('hidden', 'pattern');
    const pattern = patternText ? new RegExp(patternText) : undefined;

    hidden = {strings, pattern};
    hiddenFields.set(field.parentExplore, hidden);
  }
  return !!(hidden.pattern?.test(name) || hidden.strings.includes(name));
}

/**
 * Add `` around path elements that have special characters or are in
 * the list of reserved words
 * @param element A field path element
 * @returns A potentially quoted field path element
 */
export const quoteIfNecessary = (element: string) => {
  // Quote if contains non-word characters
  if (/\W/.test(element) || RESERVED.includes(element.toUpperCase())) {
    return `\`${element}\``;
  }
  return element;
};

/**
 * Retrieve a source from a model safely
 *
 * @param modelDef Model definition
 * @param sourceName Source name
 * @returns SourceDef for given name, or throws if not a source
 */

export const getSourceDef = (modelDef: ModelDef, sourceName: string) => {
  const result = modelDef.contents[sourceName];
  if (isSourceDef(result)) {
    return result;
  }
  throw new Error(`Not a source: ${sourceName}`);
};

/*
 * It would be nice if these types made it out of Malloy, or if this
 * functionality moved into core Malloy
 */

interface NativeUnsupportedTypeDef {
  type: 'sql native';
  rawType?: string;
}

interface RecordElementTypeDef {
  type: 'record_element';
}

type TypeDef =
  | RepeatedRecordTypeDef
  | AtomicTypeDef
  | NativeUnsupportedTypeDef
  | RecordElementTypeDef;

export const getTypeLabelFromStructDef = (structDef: StructDef): string => {
  const getTypeLabelFromTypeDef = (typeDef: TypeDef): string => {
    if (typeDef.type === 'array') {
      return `${getTypeLabelFromTypeDef(typeDef.elementTypeDef)}[]`;
    }
    if (typeDef.type === 'sql native' && typeDef.rawType) {
      return `${typeDef.type} (${typeDef.rawType})`;
    }
    return typeDef.type;
  };

  if (structDef.type === 'array') {
    return `${getTypeLabelFromTypeDef(structDef.elementTypeDef)}[]`;
  }
  return structDef.type;
};

export const getTypeLabel = (field: Field): string => {
  if (field.isExplore()) {
    if (field.isArray) {
      return getTypeLabelFromStructDef(field.structDef);
    } else {
      return '';
    }
  }
  let typeLabel = fieldType(field);
  if (field.isAtomicField() && field.isUnsupported()) {
    typeLabel = `${typeLabel} (${field.rawType})`;
  }
  return typeLabel;
};

const RESERVED: string[] = [
  'ALL',
  'AND',
  'AS',
  'ASC',
  'AVG',
  'BOOLEAN',
  'BY',
  'CASE',
  'CAST',
  'CONDITION',
  'COUNT',
  'DATE',
  'DAY',
  'DAYS',
  'DESC',
  'DISTINCT',
  'ELSE',
  'END',
  'EXCLUDE',
  'EXTEND',
  'FALSE',
  'FULL',
  'FOR',
  'FROM',
  'FROM_SQL',
  'HAS',
  'HOUR',
  'HOURS',
  'IMPORT',
  'INNER',
  'IS',
  'JSON',
  'LAST',
  'LEFT',
  'MAX',
  'MIN',
  'MINUTE',
  'MINUTES',
  'MONTH',
  'MONTHS',
  'NOT',
  'NOW',
  'NULL',
  'NUMBER',
  'ON',
  'OR',
  'PICK',
  'QUARTER',
  'QUARTERS',
  'RIGHT',
  'SECOND',
  'SECONDS',
  'STRING',
  'SOURCE_KW',
  'SUM',
  'SQL',
  'TABLE',
  'THEN',
  'THIS',
  'TIMESTAMP',
  'TO',
  'TRUE',
  'TURTLE',
  'WEEK',
  'WEEKS',
  'WHEN',
  'WITH',
  'YEAR',
  'YEARS',
  'UNGROUPED',
] as const;
