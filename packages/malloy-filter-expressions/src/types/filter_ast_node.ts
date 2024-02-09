/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Represents a Node in the AST produced by the filter expressions parser
 */
export interface FilterASTNode {
  type?: string;
  left?: FilterASTNode;
  right?: FilterASTNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [propName: string]: any;
}
