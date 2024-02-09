/*

 MIT License

 Copyright (c) 2022 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */
import union from 'lodash/union';
import {FilterASTNode} from '../../types';

/**
 * Merges the value array of two nodes, removing duplicates
 */
const mergeNodes = (
  left: FilterASTNode = {},
  right: FilterASTNode = {}
): FilterASTNode => ({
  ...left,
  type: left.type,
  value: union(left['value'], right['value']),
  is: left['is'] && right['is'],
});

/**
 * checks if the left && right.left children of this node are of the same type and can be merged
 */
const canMergeLeftNodes = (
  {left, right}: FilterASTNode,
  compareType: string,
  allowDifferentIsValue: boolean
) =>
  left &&
  right &&
  right.left &&
  left.type === right.left.type &&
  left.type === compareType &&
  (left['is'] === right.left['is'] || allowDifferentIsValue);

/**
 * checks if left && right children of node are of the same type and can be merged
 */
const canMergeEndNodes = (
  {left, right}: FilterASTNode,
  compareType: string,
  allowDifferentIsValue: boolean
) =>
  left &&
  right &&
  left.type === right.type &&
  left.type === compareType &&
  (left['is'] === right['is'] || allowDifferentIsValue);

/**
 * Traverses AST and merges nodes of the same multi value type
 */
const mergeNodesWithSameType = (
  root: FilterASTNode,
  compareType: string,
  allowDifferentIsValue = false
): FilterASTNode => {
  let node: FilterASTNode = root;

  while (canMergeLeftNodes(node, compareType, allowDifferentIsValue)) {
    const {left, right, ...rest} = node;
    const newLeft = mergeNodes(left, right?.left);
    const newRight = right?.right;
    node = {...rest, left: newLeft, right: newRight};
  }

  if (canMergeEndNodes(node, compareType, allowDifferentIsValue)) {
    node = mergeNodes(node.left, node.right);
  }
  return node;
};

/**
 * Transforms the AST by
 * - combining sequential nodes of the same type into a single node
 * Used for merging number('=') and string('match') nodes of same type
 */
export const mergeMultiValueNodes = (
  root: FilterASTNode,
  type: string,
  mergeDifferentIsValue = false
): FilterASTNode => {
  const workingRoot = mergeNodesWithSameType(root, type, mergeDifferentIsValue);
  let pointer = workingRoot;
  while (pointer.right) {
    pointer.right = mergeNodesWithSameType(
      pointer.right,
      type,
      mergeDifferentIsValue
    );
    pointer = pointer.right;
  }
  return workingRoot;
};
