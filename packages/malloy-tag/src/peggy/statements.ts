/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Intermediate representation for tag statements.
 * The Peggy parser outputs these, and the interpreter executes them to build a Tag.
 */

// Scalar value types
export type ScalarValue =
  | {kind: 'string'; value: string}
  | {kind: 'number'; value: number}
  | {kind: 'boolean'; value: boolean}
  | {kind: 'date'; value: Date}
  | {kind: 'reference'; ups: number; path: (string | number)[]};

// Values that can be assigned
export type TagValue = ScalarValue | {kind: 'array'; elements: ArrayElement[]};

export type ArrayElement = {
  value?: TagValue;
  properties?: TagStatement[];
};

// Operations the parser outputs
export type TagStatement =
  // name = value { properties }  or  name = value {...}
  | {
      kind: 'setEq';
      path: string[];
      value: TagValue;
      properties?: TagStatement[];
      preserveProperties?: boolean; // true when {...} is used
    }
  // name = { properties }  or  name = ... { properties }
  | {
      kind: 'replaceProperties';
      path: string[];
      properties: TagStatement[];
      preserveValue: boolean; // true when ... is used
    }
  // name { properties }
  | {kind: 'updateProperties'; path: string[]; properties: TagStatement[]}
  // name  or  -name
  | {kind: 'define'; path: string[]; deleted: boolean}
  // -...
  | {kind: 'clearAll'};
