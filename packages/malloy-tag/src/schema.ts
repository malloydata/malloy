/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from './tags';

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
  const typeValue = schemaProp.text('Type');
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
      if (el.eq === undefined) {
        return 'tag';
      }
      if (typeof el.eq === 'string') return 'string';
      if (typeof el.eq === 'number') return 'number';
      if (typeof el.eq === 'boolean') return 'boolean';
      if (el.eq instanceof Date) return 'date';
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

interface AdditionalConfig {
  allow: boolean;
  typeRef?: string;
}

function getAdditionalConfig(
  schema: Tag,
  customTypes: TypesMap
): AdditionalConfig {
  const additional = schema.tag('Additional');
  if (additional === undefined) {
    return {allow: false};
  }

  // Additional present - check if it has a type value
  const typeValue = additional.text();
  if (typeValue === undefined) {
    // Flag form: Additional (no value) = allow any
    return {allow: true};
  }

  // Check if it's "any" explicitly
  if (typeValue === 'any') {
    return {allow: true};
  }

  // It's a type reference
  if (typeValue in customTypes || isValidSchemaType(typeValue)) {
    return {allow: true, typeRef: typeValue};
  }

  // Unknown type - treat as allow (will error on validation if type is bad)
  return {allow: true, typeRef: typeValue};
}

function validateProperties(
  tag: Tag,
  schema: Tag,
  path: string[],
  errors: SchemaError[],
  additionalConfig: AdditionalConfig,
  customTypes: TypesMap
): void {
  const requiredSection = schema.tag('Required');
  const optionalSection = schema.tag('Optional');
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
        additionalConfig,
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
        additionalConfig,
        customTypes
      );
    }
  }

  // Check for unknown properties (only if schema defines any)
  if (knownProps.size > 0) {
    for (const [propName, propTag] of tag.entries()) {
      if (!knownProps.has(propName)) {
        if (!additionalConfig.allow) {
          errors.push({
            message: `Unknown property '${propName}'`,
            path: [...path, propName],
            code: 'unknown-property',
          });
        } else if (additionalConfig.typeRef !== undefined) {
          // Validate unknown property against the Additional type
          validatePropertyAgainstType(
            propTag,
            additionalConfig.typeRef,
            propName,
            path,
            errors,
            additionalConfig,
            customTypes
          );
        }
        // else: allow any, no validation needed
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

function validateAgainstOneOf(
  propTag: Tag,
  oneOfTypes: string[],
  propName: string,
  path: string[],
  errors: SchemaError[],
  additionalConfig: AdditionalConfig,
  customTypes: TypesMap
): boolean {
  // Try each type in the oneOf list
  for (const typeName of oneOfTypes) {
    const testErrors: SchemaError[] = [];

    if (isValidSchemaType(typeName)) {
      // Built-in type
      const actualType = getActualType(propTag);
      if (typeMatches(actualType, typeName)) {
        return true; // Match found
      }
    } else if (typeName in customTypes) {
      // Custom type reference
      const refSchema = customTypes[typeName];
      const refAdditionalConfig = getAdditionalConfig(refSchema, customTypes);

      // Check if it's an enum type
      if (Array.isArray(refSchema.eq)) {
        const enumInfo = getEnumInfo(refSchema, typeName);
        if (!isSchemaError(enumInfo)) {
          validateEnumValue(propTag, enumInfo, typeName, path, testErrors);
          if (testErrors.length === 0) {
            return true; // Match found
          }
        }
        continue;
      }

      // Check if it's a pattern type
      const pattern = refSchema.text('matches');
      if (pattern !== undefined) {
        validatePattern(propTag, pattern, typeName, path, testErrors);
        if (testErrors.length === 0) {
          return true; // Match found
        }
        continue;
      }

      // Check if it's a oneOf type (nested)
      const nestedOneOf = refSchema.textArray('oneOf');
      if (nestedOneOf !== undefined && nestedOneOf.length > 0) {
        if (
          validateAgainstOneOf(
            propTag,
            nestedOneOf,
            propName,
            path,
            testErrors,
            additionalConfig,
            customTypes
          )
        ) {
          return true; // Match found
        }
        continue;
      }

      // Structural type - validate properties
      validateProperties(
        propTag,
        refSchema,
        path,
        testErrors,
        refAdditionalConfig,
        customTypes
      );
      if (testErrors.length === 0) {
        return true; // Match found
      }
    }
  }

  // No match found - report error
  errors.push({
    message: `Property '${propName}' does not match any type in oneOf: [${oneOfTypes.join(', ')}]`,
    path,
    code: 'wrong-type',
  });
  return false;
}

function validatePropertyAgainstType(
  propTag: Tag,
  typeName: string,
  propName: string,
  parentPath: string[],
  errors: SchemaError[],
  additionalConfig: AdditionalConfig,
  customTypes: TypesMap
): void {
  const path = [...parentPath, propName];

  // Check if it's a built-in type
  if (isValidSchemaType(typeName)) {
    const actualType = getActualType(propTag);
    if (!typeMatches(actualType, typeName)) {
      errors.push({
        message: `Property '${propName}' has wrong type: expected '${typeName}', got '${actualType}'`,
        path,
        code: 'wrong-type',
      });
    }
    return;
  }

  // Check if it's a custom type
  if (!(typeName in customTypes)) {
    errors.push({
      message: `Invalid type '${typeName}' in schema for '${propName}'`,
      path,
      code: 'invalid-schema',
    });
    return;
  }

  const refSchema = customTypes[typeName];
  const refAdditionalConfig = getAdditionalConfig(refSchema, customTypes);

  // Check if this is an enum type
  if (Array.isArray(refSchema.eq)) {
    const enumInfo = getEnumInfo(refSchema, typeName);
    if (isSchemaError(enumInfo)) {
      errors.push({...enumInfo, path});
      return;
    }
    validateEnumValue(propTag, enumInfo, typeName, path, errors);
    return;
  }

  // Check if this is a pattern type
  const pattern = refSchema.text('matches');
  if (pattern !== undefined) {
    validatePattern(propTag, pattern, typeName, path, errors);
    return;
  }

  // Check if this is a oneOf type
  const oneOfTypes = refSchema.textArray('oneOf');
  if (oneOfTypes !== undefined && oneOfTypes.length > 0) {
    validateAgainstOneOf(
      propTag,
      oneOfTypes,
      propName,
      path,
      errors,
      additionalConfig,
      customTypes
    );
    return;
  }

  // Structural type - validate properties
  validateProperties(
    propTag,
    refSchema,
    path,
    errors,
    refAdditionalConfig,
    customTypes
  );
}

function validateProperty(
  propTag: Tag,
  schemaProp: Tag,
  propName: string,
  parentPath: string[],
  errors: SchemaError[],
  additionalConfig: AdditionalConfig,
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
    const refAdditionalConfig = getAdditionalConfig(refSchema, customTypes);

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

    // Check if this is a oneOf type
    const oneOfTypes = refSchema.textArray('oneOf');
    if (oneOfTypes !== undefined && oneOfTypes.length > 0) {
      validateEachElement(propTag, typeRefArray, typeRef, path, errors, el =>
        validateAgainstOneOf(
          el.tag,
          oneOfTypes,
          propName,
          el.path,
          errors,
          additionalConfig,
          customTypes
        )
      );
      return;
    }

    // Regular custom type - validate properties
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
            refAdditionalConfig,
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
        refAdditionalConfig,
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

  // Check for nested Required/Optional sections in schema
  const nestedRequired = schemaProp.tag('Required');
  const nestedOptional = schemaProp.tag('Optional');

  if (nestedRequired !== undefined || nestedOptional !== undefined) {
    const nestedAdditionalConfig = getAdditionalConfig(schemaProp, customTypes);
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
            nestedAdditionalConfig,
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
        nestedAdditionalConfig,
        customTypes
      );
    }
  }
}

/**
 * Validate a tag against a schema.
 *
 * The schema is itself a Tag that defines Required and Optional properties:
 *
 * ```motly
 * Types: {
 *   ItemType: {
 *     Required: { name=string price=number }
 *   }
 * }
 * Required: {
 *   color=string
 *   items="ItemType[]"
 * }
 * Optional: {
 *   border=number
 * }
 * ```
 *
 * Type specifiers: string, number, boolean, date, tag, any
 * Array types: string[], number[], boolean[], date[], tag[], any[]
 * Custom types: defined in `Types` section, referenced by name or name[]
 * Union types: TypeName.oneOf = [type1, type2, ...]
 *
 * Additional properties:
 * - No `Additional`: reject unknown properties
 * - `Additional`: allow any additional properties (same as `Additional = any`)
 * - `Additional = TypeName`: validate additional properties against type
 *
 * @param tag The tag to validate
 * @param schema The schema to validate against (as a Tag)
 * @returns Array of schema errors, empty if valid
 */
export function validateTag(tag: Tag, schema: Tag): SchemaError[] {
  const errors: SchemaError[] = [];

  // Extract custom types from schema
  const typesSection = schema.tag('Types');
  const customTypes: TypesMap = {};
  if (typesSection) {
    for (const [name, typeDef] of typesSection.entries()) {
      customTypes[name] = typeDef;
    }
  }

  const additionalConfig = getAdditionalConfig(schema, customTypes);

  validateProperties(tag, schema, [], errors, additionalConfig, customTypes);
  return errors;
}
