/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Tag} from './tags';

export interface SchemaError {
  message: string;
  path: string[];
  code:
    | 'missing-required'
    | 'wrong-type'
    | 'unknown-property'
    | 'invalid-schema';
}

type SchemaType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'tag'
  | 'any'
  | 'string[]'
  | 'number[]'
  | 'boolean[]'
  | 'date[]'
  | 'tag[]'
  | 'any[]';

const VALID_TYPES: SchemaType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'tag',
  'any',
  'string[]',
  'number[]',
  'boolean[]',
  'date[]',
  'tag[]',
  'any[]',
];

function isValidSchemaType(value: string): value is SchemaType {
  return VALID_TYPES.includes(value as SchemaType);
}

function isArrayType(type: SchemaType): boolean {
  return type.endsWith('[]');
}

function getArrayElementType(
  type: SchemaType
): 'string' | 'number' | 'boolean' | 'date' | 'tag' | 'any' {
  return type.slice(0, -2) as
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'tag'
    | 'any';
}

interface TypeResult {
  type?: SchemaType;
  typeRef?: string;
  typeRefArray?: boolean;
  invalidType?: string;
}

type TypesMap = Record<string, Tag>;

function parseTypeSpecifier(value: string, customTypes: TypesMap): TypeResult {
  // Check built-in types first (including built-in array types)
  if (isValidSchemaType(value)) {
    return {type: value};
  }

  // Check for array suffix for custom types
  const isArray = value.endsWith('[]');
  const baseName = isArray ? value.slice(0, -2) : value;

  // Check if it's a custom type reference
  if (baseName in customTypes) {
    return {typeRef: baseName, typeRefArray: isArray};
  }

  // Unknown type
  return {invalidType: value};
}

function getExpectedType(schemaProp: Tag, customTypes: TypesMap): TypeResult {
  // Check for shorthand: prop=string, prop=number, prop=customType, etc.
  const eqValue = schemaProp.text();
  if (eqValue !== undefined) {
    return parseTypeSpecifier(eqValue, customTypes);
  }

  // Check for full form: prop: { type=string }
  const typeValue = schemaProp.text('type');
  if (typeValue !== undefined) {
    return parseTypeSpecifier(typeValue, customTypes);
  }

  return {};
}

function getActualType(tag: Tag): string {
  const eq = tag.eq;

  if (eq === undefined) {
    // Has properties but no value - it's a "tag" type
    return 'tag';
  }

  if (Array.isArray(eq)) {
    // Check element types in array
    if (eq.length === 0) {
      return 'any[]'; // Empty array, could be any type
    }

    const elementTypes = eq.map(el => {
      const elTag = Tag.tagFrom(el);
      if (elTag.eq === undefined) {
        return 'tag';
      }
      if (typeof elTag.eq === 'string') return 'string';
      if (typeof elTag.eq === 'number') return 'number';
      if (typeof elTag.eq === 'boolean') return 'boolean';
      if (elTag.eq instanceof Date) return 'date';
      return 'unknown';
    });

    // Check if all elements are the same type
    const firstType = elementTypes[0];
    const allSame = elementTypes.every(t => t === firstType);

    if (allSame && firstType !== 'unknown') {
      return `${firstType}[]`;
    }

    return 'mixed[]';
  }

  if (typeof eq === 'string') return 'string';
  if (typeof eq === 'number') return 'number';
  if (typeof eq === 'boolean') return 'boolean';
  if (eq instanceof Date) return 'date';

  return 'unknown';
}

function typeMatches(actualType: string, expectedType: SchemaType): boolean {
  if (expectedType === 'any') {
    return true;
  }

  if (expectedType === 'tag') {
    return actualType === 'tag';
  }

  if (isArrayType(expectedType)) {
    const elementType = getArrayElementType(expectedType);

    // Check if actual is an array type
    if (!actualType.endsWith('[]')) {
      return false;
    }

    if (elementType === 'any') {
      return true; // any[] matches any array
    }

    // Extract actual element type
    const actualElementType = actualType.slice(0, -2);

    // Empty arrays (any[]) match any array type
    if (actualElementType === 'any') {
      return true;
    }

    return actualElementType === elementType;
  }

  return actualType === expectedType;
}

function validateProperties(
  tag: Tag,
  schema: Tag,
  path: string[],
  errors: SchemaError[],
  allowUnknown: boolean,
  customTypes: TypesMap
): void {
  const requiredSection = schema.tag('required');
  const optionalSection = schema.tag('optional');

  const requiredProps = requiredSection?.dict ?? {};
  const optionalProps = optionalSection?.dict ?? {};

  // Check for missing required properties
  for (const propName of Object.keys(requiredProps)) {
    const propTag = tag.tag(propName);
    if (propTag === undefined) {
      errors.push({
        message: `Missing required property '${propName}'`,
        path: [...path, propName],
        code: 'missing-required',
      });
      continue;
    }

    const schemaProp = Tag.tagFrom(requiredProps[propName]);
    validateProperty(
      propTag,
      schemaProp,
      propName,
      path,
      errors,
      allowUnknown,
      customTypes
    );
  }

  // Check optional properties that exist
  for (const propName of Object.keys(optionalProps)) {
    const propTag = tag.tag(propName);
    if (propTag === undefined) {
      continue; // Optional, so OK if missing
    }

    const schemaProp = Tag.tagFrom(optionalProps[propName]);
    validateProperty(
      propTag,
      schemaProp,
      propName,
      path,
      errors,
      allowUnknown,
      customTypes
    );
  }

  // Check for unknown properties
  if (!allowUnknown) {
    const tagDict = tag.dict;
    for (const propName of Object.keys(tagDict)) {
      if (!(propName in requiredProps) && !(propName in optionalProps)) {
        errors.push({
          message: `Unknown property '${propName}'`,
          path: [...path, propName],
          code: 'unknown-property',
        });
      }
    }
  }
}

function validateProperty(
  propTag: Tag,
  schemaProp: Tag,
  propName: string,
  parentPath: string[],
  errors: SchemaError[],
  allowUnknown: boolean,
  customTypes: TypesMap
): void {
  const path = [...parentPath, propName];
  const {
    type: expectedType,
    typeRef,
    typeRefArray,
    invalidType,
  } = getExpectedType(schemaProp, customTypes);

  if (invalidType !== undefined) {
    errors.push({
      message: `Invalid type '${invalidType}' in schema for '${propName}'`,
      path,
      code: 'invalid-schema',
    });
    return; // Don't continue validation with invalid schema
  }

  // Handle custom type reference
  if (typeRef !== undefined) {
    const refSchema = customTypes[typeRef];
    // Use the referenced type's allowUnknown setting, not the parent's
    const refAllowUnknown = refSchema.isTrue('allowUnknown');

    if (typeRefArray) {
      // Validate as array of custom type
      const actualType = getActualType(propTag);
      if (!actualType.endsWith('[]')) {
        errors.push({
          message: `Property '${propName}' has wrong type: expected '${typeRef}[]', got '${actualType}'`,
          path,
          code: 'wrong-type',
        });
        return;
      }

      const array = propTag.array();
      if (array) {
        for (let i = 0; i < array.length; i++) {
          validateProperties(
            array[i],
            refSchema,
            [...path, String(i)],
            errors,
            refAllowUnknown,
            customTypes
          );
        }
      }
    } else {
      // Validate against referenced type schema
      validateProperties(
        propTag,
        refSchema,
        path,
        errors,
        refAllowUnknown,
        customTypes
      );
    }
    return;
  }

  if (expectedType !== undefined) {
    const actualType = getActualType(propTag);

    if (!typeMatches(actualType, expectedType)) {
      errors.push({
        message: `Property '${propName}' has wrong type: expected '${expectedType}', got '${actualType}'`,
        path,
        code: 'wrong-type',
      });
      return; // Don't validate nested if type is wrong
    }
  }

  // Check for nested required/optional sections in schema
  const nestedRequired = schemaProp.tag('required');
  const nestedOptional = schemaProp.tag('optional');

  if (nestedRequired !== undefined || nestedOptional !== undefined) {
    // If this is an array type, validate each element against the nested schema
    if (expectedType !== undefined && isArrayType(expectedType)) {
      const array = propTag.array();
      if (array) {
        for (let i = 0; i < array.length; i++) {
          validateProperties(
            array[i],
            schemaProp,
            [...path, String(i)],
            errors,
            allowUnknown,
            customTypes
          );
        }
      }
    } else {
      validateProperties(
        propTag,
        schemaProp,
        path,
        errors,
        allowUnknown,
        customTypes
      );
    }
  }
}

/**
 * Validate a tag against a schema.
 *
 * The schema is itself a Tag that defines required and optional properties:
 *
 * ```motly
 * types: {
 *   itemType: {
 *     required: { name=string price=number }
 *   }
 * }
 * required: {
 *   color=string
 *   items="itemType[]"
 * }
 * optional: {
 *   border=number
 * }
 * ```
 *
 * Type specifiers: string, number, boolean, date, tag, any
 * Array types: string[], number[], boolean[], date[], tag[], any[]
 * Custom types: defined in `types` section, referenced by name or name[]
 *
 * @param tag The tag to validate
 * @param schema The schema to validate against (as a Tag)
 * @returns Array of schema errors, empty if valid
 */
export function validateTag(tag: Tag, schema: Tag): SchemaError[] {
  const errors: SchemaError[] = [];
  const allowUnknown = schema.isTrue('allowUnknown');

  // Extract custom types from schema
  const typesSection = schema.tag('types');
  const customTypes: TypesMap = {};
  if (typesSection) {
    for (const [name, typeDef] of Object.entries(typesSection.dict)) {
      customTypes[name] = typeDef;
    }
  }

  validateProperties(tag, schema, [], errors, allowUnknown, customTypes);
  return errors;
}
