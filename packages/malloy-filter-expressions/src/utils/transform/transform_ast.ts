/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import cloneDeep from 'lodash/cloneDeep';
import flow from 'lodash/fp/flow';
import {FilterASTNode, TransformFunction} from '../../types';
import addId from './utils/apply_id_to_ast';

/**
 * Basic AST transform clones and adds an ID to each node
 */
export const transformAST = (
  root: FilterASTNode,
  transforms: TransformFunction[]
): FilterASTNode =>
  flow([...transforms, cloneDeep, addId])(root) as FilterASTNode;
