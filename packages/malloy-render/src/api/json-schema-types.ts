/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Generic JSON Schema types

export interface JSONSchemaPropertyBase {
  title?: string;
  description?: string;
  default?: unknown;
}

export type JSONSchemaProperty =
  | JSONSchemaObject
  | JSONSchemaArray
  | JSONSchemaString
  | JSONSchemaFieldString
  | JSONSchemaNumber
  | JSONSchemaBoolean
  | JSONSchemaOneOf;

export interface JSONSchemaObject extends JSONSchemaPropertyBase {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: readonly string[];
  additionalProperties?: boolean;
}

export interface JSONSchemaArray extends JSONSchemaPropertyBase {
  type: 'array';
  items: JSONSchemaProperty;
}

export interface JSONSchemaString extends JSONSchemaPropertyBase {
  type: 'string';
  enum?: readonly string[];
}

export interface JSONSchemaFieldString extends JSONSchemaString {
  subtype: 'field';
  fieldTypes?: readonly string[];
}

export interface JSONSchemaNumber extends JSONSchemaPropertyBase {
  type: 'number';
  minimum?: number;
  maximum?: number;
}

export interface JSONSchemaBoolean extends JSONSchemaPropertyBase {
  type: 'boolean';
}

export interface JSONSchemaOneOf extends JSONSchemaPropertyBase {
  type: 'oneOf';
  oneOf: JSONSchemaProperty[];
}
