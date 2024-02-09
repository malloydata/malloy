/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from './filter_ast_node';

export type TransformFunction = (root: FilterASTNode) => FilterASTNode;
