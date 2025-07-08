/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Token} from 'moo';
import {parseString} from './util';

export interface AstNode {
  type: string;
}

export interface StringLiteral extends AstNode {
  type: 'StringLiteral';
  value: string;
}

export interface NumberLiteral extends AstNode {
  type: 'NumberLiteral';
  value: string;
}

export interface Identifier extends AstNode {
  type: 'Identifier';
  value: string;
}

// Represents a dot-separated property path
export interface PropertyPath extends AstNode {
  type: 'PropertyPath';
  value: string[];
}

export interface Properties extends AstNode {
  type: 'Properties';
  isDotty: boolean;
  tags: TagSpec[];
}

export interface ArrayValue extends AstNode {
  type: 'ArrayValue';
  elements: ArrayElement[];
}

export interface ArrayElement extends AstNode {
  type: 'ArrayElement';
  value: StringLiteral | NumberLiteral | ArrayValue | Properties;
  properties?: Properties;
}

// New interface for the top-level node
export interface TagLine extends AstNode {
  type: 'TagLine';
  tags: TagSpec[];
}

// --- Specific TagSpec Interfaces ---

export interface TagSpec_EqValue extends AstNode {
  type: 'TagSpec_EqValue';
  propName: PropertyPath;
  value: StringLiteral | NumberLiteral | ArrayValue;
  properties?: Properties;
}

export interface TagSpec_EqDotty extends AstNode {
  type: 'TagSpec_EqDotty';
  isDotty: boolean;
  propName: PropertyPath;
  properties: Properties;
}

export interface TagSpec_PropOnly extends AstNode {
  type: 'TagSpec_PropOnly';
  propName: PropertyPath;
  properties: Properties;
}

export interface TagSpec_MinusProp extends AstNode {
  type: 'TagSpec_MinusProp';
  propName: PropertyPath;
  isNegated: boolean;
}

export interface TagSpec_MinusDotty extends AstNode {
  type: 'TagSpec_MinusDotty';
}

// Union type for any kind of TagSpec
export type TagSpec =
  | TagSpec_EqValue
  | TagSpec_EqDotty
  | TagSpec_PropOnly
  | TagSpec_MinusProp
  | TagSpec_MinusDotty;

// Union type for any AST node in the tree
export type AnyAstNode =
  | StringLiteral
  | NumberLiteral
  | Identifier
  | PropertyPath
  | Properties
  | ArrayValue
  | ArrayElement
  | TagSpec
  | TagLine;

// --- Type Guard Functions ---

function isToken(t: unknown): t is Token {
  return typeof t === 'object' && t !== null && 'value' in t && 'text' in t;
}

function isAstNode(node: unknown): node is AstNode {
  return typeof node === 'object' && node !== null && 'type' in node;
}

function isStringLiteral(node: unknown): node is StringLiteral {
  return isAstNode(node) && node.type === 'StringLiteral';
}

function isNumberLiteral(node: unknown): node is NumberLiteral {
  return isAstNode(node) && node.type === 'NumberLiteral';
}

function isArrayValue(node: unknown): node is ArrayValue {
  return isAstNode(node) && node.type === 'ArrayValue';
}

function isIdentifier(node: unknown): node is Identifier {
  return isAstNode(node) && node.type === 'Identifier';
}

function isPropertyPath(node: unknown): node is PropertyPath {
  return isAstNode(node) && node.type === 'PropertyPath';
}

function isProperties(node: unknown): node is Properties {
  return isAstNode(node) && node.type === 'Properties';
}

function isArrayElement(node: unknown): node is ArrayElement {
  return isAstNode(node) && node.type === 'ArrayElement';
}

function isTagLine(node: unknown): node is TagLine {
  return isAstNode(node) && node.type === 'TagLine';
}

function isTagSpec(node: unknown): node is TagSpec {
  if (!isAstNode(node)) return false;
  return (
    node.type === 'TagSpec_EqValue' ||
    node.type === 'TagSpec_EqDotty' ||
    node.type === 'TagSpec_PropOnly' ||
    node.type === 'TagSpec_MinusProp' ||
    node.type === 'TagSpec_MinusDotty'
  );
}

export function isAnyAstNode(node: unknown): node is AnyAstNode {
  return (
    isStringLiteral(node) ||
    isNumberLiteral(node) ||
    isIdentifier(node) ||
    isPropertyPath(node) ||
    isProperties(node) ||
    isArrayValue(node) ||
    isArrayElement(node) ||
    isTagSpec(node) ||
    isTagLine(node)
  );
}

function isEqValue(
  node: unknown
): node is StringLiteral | NumberLiteral | ArrayValue {
  return isStringLiteral(node) || isNumberLiteral(node) || isArrayValue(node);
}

// --- Helper Functions ---

function buildList<T>(head: T, tail: [unknown, T][]): T[] {
  const result: T[] = [head];
  for (const item of tail) {
    result.push(item[1]);
  }
  return result;
}

// --- Exported Processor Functions ---

export function createTagLine(data: unknown[]): TagLine {
  const [tagSpecs] = data;
  if (!Array.isArray(tagSpecs) || !tagSpecs.every(isTagSpec)) {
    throw new Error('createTagLine expected an array of TagSpecs');
  }
  return {
    type: 'TagLine',
    tags: tagSpecs,
  };
}

export function createTagSpec_EqValue(data: unknown[]): TagSpec_EqValue {
  const [propName, , value, properties] = data;

  if (!isPropertyPath(propName)) {
    throw new Error(
      'createTagSpec_EqValue expected a PropertyPath for propName'
    );
  }
  if (!isEqValue(value)) {
    const type = isAstNode(value) ? value.type : typeof value;
    throw new Error(
      `createTagSpec_EqValue expected String, Number, or Array for the value, but got a node of type '${type}'`
    );
  }
  if (properties !== null && !isProperties(properties)) {
    throw new Error('createTagSpec_EqValue expected Properties or null');
  }

  return {
    type: 'TagSpec_EqValue',
    propName: propName,
    value: value,
    properties: properties || undefined,
  };
}

export function createTagSpec_EqDotty(data: unknown[]): TagSpec_EqDotty {
  const [propName, , isDotty, properties] = data;
  if (!isPropertyPath(propName)) {
    throw new Error(
      'createTagSpec_EqDotty expected a PropertyPath for propName'
    );
  }
  if (!isProperties(properties)) {
    throw new Error('createTagSpec_EqDotty expected Properties');
  }

  return {
    type: 'TagSpec_EqDotty',
    isDotty: !!isDotty,
    propName: propName,
    properties: properties,
  };
}

export function createTagSpec_PropOnly(data: unknown[]): TagSpec_PropOnly {
  const [propName, properties] = data;
  if (!isPropertyPath(propName)) {
    throw new Error(
      'createTagSpec_PropOnly expected a PropertyPath for propName'
    );
  }
  if (!isProperties(properties)) {
    throw new Error('createTagSpec_PropOnly expected Properties');
  }

  return {
    type: 'TagSpec_PropOnly',
    propName: propName,
    properties: properties,
  };
}

export function createTagSpec_MinusProp(data: unknown[]): TagSpec_MinusProp {
  const [minusToken, propName] = data;
  if (!isPropertyPath(propName)) {
    throw new Error(
      'createTagSpec_MinusProp expected a PropertyPath for propName'
    );
  }

  return {
    type: 'TagSpec_MinusProp',
    isNegated: !!minusToken,
    propName: propName,
  };
}

export function createTagSpec_MinusDotty(_data: unknown[]): TagSpec_MinusDotty {
  return {type: 'TagSpec_MinusDotty'};
}

export function createStringLiteral(data: unknown[]): StringLiteral {
  const [token] = data;
  if (!isToken(token)) {
    throw new Error('createStringLiteral expected a Token');
  }

  const rawText = token.value;
  if (token.type === 'BARE_STRING') {
    return {type: 'StringLiteral', value: rawText};
  }
  return {type: 'StringLiteral', value: parseString(rawText, rawText[0])};
}

export function createIdentifier(data: unknown[]): Identifier {
  const [token] = data;
  if (!isToken(token)) {
    throw new Error('createIdentifier expected a Token');
  }
  const value =
    token.type === 'BQ_STRING' ? parseString(token.value, '`') : token.value;
  return {type: 'Identifier', value};
}

export function createPropName(data: unknown[]): PropertyPath {
  const [firstIdentifier, otherParts] = data;

  if (!isIdentifier(firstIdentifier) || !Array.isArray(otherParts)) {
    // This is a sanity check, should not be hit with a correct grammar.
    throw new Error('Invalid data structure for createPropName');
  }

  const path = [firstIdentifier.value];

  for (const part of otherParts) {
    if (isIdentifier(part[1])) {
      path.push(part[1].value);
    }
  }

  return {type: 'PropertyPath', value: path};
}

export function createNumberLiteral(data: unknown[]): NumberLiteral {
  const [token] = data;
  if (!isToken(token)) {
    throw new Error('createNumberLiteral expected a Token');
  }
  return {type: 'NumberLiteral', value: token.text};
}

export function processEqValue(data: unknown[]): AstNode {
  const [value] = data;
  if (!isAstNode(value)) {
    throw new Error('processEqValue expected an AstNode');
  }
  return value;
}

export function createArrayElement_String(data: unknown[]): ArrayElement {
  const [stringValue, properties] = data;
  if (!isStringLiteral(stringValue)) {
    throw new Error('createArrayElement_String expected a StringLiteral');
  }
  if (properties !== null && !isProperties(properties)) {
    throw new Error('createArrayElement_String expected Properties or null');
  }

  return {
    type: 'ArrayElement',
    value: stringValue,
    properties: properties || undefined,
  };
}

export function createArrayElement_Node(data: unknown[]): ArrayElement {
  const [value] = data;
  if (!isNumberLiteral(value) && !isArrayValue(value) && !isProperties(value)) {
    throw new Error(
      'createArrayElement_Node expected a Number, Array, or Properties'
    );
  }
  return {type: 'ArrayElement', value: value};
}

export function createElementList(data: unknown[]): ArrayElement[] {
  const [head, tail] = data;
  if (!isArrayElement(head)) {
    throw new Error('createElementList expected an ArrayElement as head');
  }
  if (!Array.isArray(tail)) {
    throw new Error('createElementList expected an array for tail');
  }

  for (const item of tail) {
    if (!Array.isArray(item) || item.length < 2 || !isArrayElement(item[1])) {
      throw new Error(
        'createElementList expected tail to be an array of [separator, ArrayElement] tuples'
      );
    }
  }
  return buildList(head, tail as [unknown, ArrayElement][]);
}

export function createArrayValue(data: unknown[]): ArrayValue {
  // [AR_BEG, elements, AR_END ]
  const elements = data[1] || [];

  if (!Array.isArray(elements) || !elements.every(isArrayElement)) {
    throw new Error(
      'createArrayValue expected an array of ArrayElements inside the wrapper'
    );
  }

  return {type: 'ArrayValue', elements: elements};
}

export function createProperties(data: unknown[]): Properties {
  const [_prBeg, isDotty, tags, _prEnd] = data;

  if (!Array.isArray(tags) || !tags.every(isTagSpec)) {
    throw new Error(
      "createProperties expected an array of TagSpecs for the 'tags' property."
    );
  }

  return {
    type: 'Properties',
    isDotty: !!isDotty,
    tags: tags,
  };
}
