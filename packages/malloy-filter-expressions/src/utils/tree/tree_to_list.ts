/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode, FilterModel} from '../../types';
import {inorderTraversal} from './inorder_traversal';

/**
 * Convert a FilterAST to a list of FilterASTNodes using in order traversal (left, node, right)
 *    (root(1))      ->  [0,1,2,3,4]
 *    /      \
 * left(0)   right(3)
 *           /     \
 *      left(2)     right(4)
 */
export const treeToList = (root: FilterASTNode): FilterModel[] => {
  const orItems: FilterModel[] = [];
  const andItems: FilterModel[] = [];
  inorderTraversal(root, (node: FilterASTNode) => {
    const item = node as FilterModel;
    if (item.type !== ',') {
      (item.is ? orItems : andItems).push(item);
    }
  });
  return [...orItems, ...andItems];
};
