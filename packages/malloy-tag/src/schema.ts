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
    | 'invalid-schema'
    | 'invalid-enum-value'
    | 'pattern-mismatch';
}

type SchemaType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'tag'
  | 'flag'
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
  'flag',
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
    // No value - check if it has properties
    if (!tag.hasProperties()) {
      // No value and no properties - it's a flag (presence-only)
      return 'flag';
    }
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
  const knownProps = new Set<string>();

  // Check required properties
  if (requiredSection) {
    for (const [propName, schemaProp] of requiredSection.entries()) {
      knownProps.add(propName);
      const propTag = tag.tag(propName);
      if (propTag === undefined) {
        errors.push({
          message: `Missing required property '${propName}'`,
          path: [...path, propName],
          code: 'missing-required',
        });
        continue;
      }
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
  }

  // Check optional properties that exist
  if (optionalSection) {
    for (const [propName, schemaProp] of optionalSection.entries()) {
      knownProps.add(propName);
      const propTag = tag.tag(propName);
      if (propTag === undefined) {
        continue; // Optional, so OK if missing
      }
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
  }

  // Check for unknown properties (only if schema defines any)
  if (!allowUnknown && knownProps.size > 0) {
    for (const [propName] of tag.entries()) {
      if (!knownProps.has(propName)) {
        errors.push({
          message: `Unknown property '${propName}'`,
          path: [...path, propName],
          code: 'unknown-property',
        });
      }
    }
  }
}

interface EnumInfo {
  kind: 'string' | 'number';
  values: string[] | number[];
}

function getEnumInfo(refSchema: Tag, typeName: string): EnumInfo | SchemaError {
  const array = refSchema.array();
  if (!array || array.length === 0) {
    return {
      message: `Enum type '${typeName}' has no values`,
      path: [],
      code: 'invalid-schema',
    };
  }

  // Check what types are in the array
  let hasStrings = false;
  let hasNumbers = false;
  const stringValues: string[] = [];
  const numberValues: number[] = [];

  for (const el of array) {
    const val = el.eq;
    if (typeof val === 'string') {
      hasStrings = true;
      stringValues.push(val);
    } else if (typeof val === 'number') {
      hasNumbers = true;
      numberValues.push(val);
    }
  }

  // Check for mixed types
  if (hasStrings && hasNumbers) {
    return {
      message: `Enum type '${typeName}' has mixed types (must be all strings or all numbers)`,
      path: [],
      code: 'invalid-schema',
    };
  }

  if (hasStrings) {
    return {kind: 'string', values: stringValues};
  }
  if (hasNumbers) {
    return {kind: 'number', values: numberValues};
  }

  return {
    message: `Enum type '${typeName}' has no valid values (must be strings or numbers)`,
    path: [],
    code: 'invalid-schema',
  };
}

function isSchemaError(x: EnumInfo | SchemaError): x is SchemaError {
  return 'code' in x;
}

function validateEnumValue(
  tag: Tag,
  enumInfo: EnumInfo,
  typeName: string,
  path: string[],
  errors: SchemaError[]
): void {
  const actualValue = tag.eq;

  if (enumInfo.kind === 'string') {
    if (
      typeof actualValue === 'string' &&
      (enumInfo.values as string[]).includes(actualValue)
    ) {
      return;
    }
  } else {
    if (
      typeof actualValue === 'number' &&
      (enumInfo.values as number[]).includes(actualValue)
    ) {
      return;
    }
  }

  const allowedStr = enumInfo.values.map(v => String(v)).join(', ');
  errors.push({
    message: `Value '${actualValue}' is not a valid ${typeName}. Allowed values: [${allowedStr}]`,
    path,
    code: 'invalid-enum-value',
  });
}

function validatePattern(
  tag: Tag,
  pattern: string,
  typeName: string,
  path: string[],
  errors: SchemaError[]
): void {
  const actualValue = tag.eq;

  // Pattern only applies to strings
  if (typeof actualValue !== 'string') {
    errors.push({
      message: `Value must be a string to match pattern for type '${typeName}', got ${typeof actualValue}`,
      path,
      code: 'wrong-type',
    });
    return;
  }

  try {
    const regex = new RegExp(pattern);
    if (!regex.test(actualValue)) {
      errors.push({
        message: `Value '${actualValue}' does not match pattern for type '${typeName}'`,
        path,
        code: 'pattern-mismatch',
      });
    }
  } catch {
    errors.push({
      message: `Invalid regex pattern '${pattern}' in type '${typeName}'`,
      path,
      code: 'invalid-schema',
    });
  }
}

function validateEachElement(
  propTag: Tag,
  isArray: boolean | undefined,
  typeName: string,
  path: string[],
  errors: SchemaError[],
  validate: (el: {tag: Tag; path: string[]}) => void
): void {
  if (isArray === true) {
    const array = propTag.array();
    if (!array) {
      const actualType = getActualType(propTag);
      errors.push({
        message: `Expected '${typeName}[]', got '${actualType}'`,
        path,
        code: 'wrong-type',
      });
      return;
    }
    for (let i = 0; i < array.length; i++) {
      validate({tag: array[i], path: [...path, String(i)]});
    }
  } else {
    validate({tag: propTag, path});
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

    // Check if this is an enum type (custom type value is an array)
    if (Array.isArray(refSchema.eq)) {
      const enumInfo = getEnumInfo(refSchema, typeRef);
      if (isSchemaError(enumInfo)) {
        errors.push({...enumInfo, path});
        return;
      }
      validateEachElement(propTag, typeRefArray, typeRef, path, errors, el =>
        validateEnumValue(el.tag, enumInfo, typeRef, el.path, errors)
      );
      return;
    }

    // Check if this is a pattern type (custom type has 'matches' property)
    const pattern = refSchema.text('matches');
    if (pattern !== undefined) {
      validateEachElement(propTag, typeRefArray, typeRef, path, errors, el =>
        validatePattern(el.tag, pattern, typeRef, el.path, errors)
      );
      return;
    }

    // Regular custom type - validate properties
    const refAllowUnknown = refSchema.has('allowUnknown');

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
  const allowUnknown = schema.has('allowUnknown');

  // Extract custom types from schema
  const typesSection = schema.tag('types');
  const customTypes: TypesMap = {};
  if (typesSection) {
    for (const [name, typeDef] of typesSection.entries()) {
      customTypes[name] = typeDef;
    }
  }

  validateProperties(tag, schema, [], errors, allowUnknown, customTypes);
  return errors;
}
