/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from '../../types';
import applyId from '../transform/utils/apply_id_to_ast';

/**
 * Adds a new node to the current ast and returns the root node
 */
export const addNode = (root: FilterASTNode, newNode: FilterASTNode) => {
  const workingRoot: FilterASTNode = root;
  if (!workingRoot.right) {
    // root is a single node
    const newRoot: FilterASTNode = {
      'type': ',',
      'left': workingRoot,
      'right': newNode,
    };
    return applyId(newRoot);
  }

  let parent = workingRoot;
  let pointer = workingRoot;
  while (pointer.right) {
    parent = pointer;
    pointer = pointer.right;
  }

  parent.right = {type: ',', left: pointer, right: newNode};
  return applyId(workingRoot);
};
