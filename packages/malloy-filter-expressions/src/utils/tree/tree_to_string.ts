/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode, FilterModel} from '../../types';
import {treeToList} from './tree_to_list';

/**
 * Given an AST and a nodeToString conversion function for that particular
 * type of filter, it converts the AST to a string expression representation
 */
export const treeToString = (
  root: FilterASTNode,
  nodeToString: (item: FilterModel) => string,
  filterNode: (item: FilterModel) => boolean = () => true
) =>
  treeToList(root)
    .filter(filterNode)
    .map(nodeToString)
    .filter(String)
    .join(',');
