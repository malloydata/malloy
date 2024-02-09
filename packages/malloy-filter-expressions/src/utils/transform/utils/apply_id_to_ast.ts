/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from '../../../types';

/**
 * Traverses the AST and assigns an id attribute to each node
 */
const applyId = (root: FilterASTNode): FilterASTNode => {
  let id = 0;
  const traverse = (node: FilterASTNode): FilterASTNode => {
    const {left, right} = node;
    let newLeft, newRight;
    if (left) {
      newLeft = traverse(left);
    }
    id += 1;
    const newNode = {...node, id};
    if (right) {
      newRight = traverse(right);
    }
    return {...newNode, left: newLeft, right: newRight};
  };
  return traverse(root);
};

export default applyId;
