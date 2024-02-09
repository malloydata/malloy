/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from '../../types';
import {mergeMultiValueNodes} from './mergeMultiValueNodes';

/**
 * Clones and adds and Id on the transformedAST
 */
export const stringTransform = (root: FilterASTNode) =>
  ['match', 'contains', 'startsWith', 'endsWith'].reduce(
    (ast, type) => mergeMultiValueNodes(ast, type),
    root
  );
