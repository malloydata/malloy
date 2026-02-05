/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Intermediate representation for tag statements.
 * The Peggy parser outputs these, and the interpreter executes them to build a Tag.
 */

// Values that can be assigned
export type TagValue =
  | {kind: 'string'; value: string}
  | {kind: 'array'; elements: ArrayElement[]}
  | {kind: 'reference'; path: string[]};

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
