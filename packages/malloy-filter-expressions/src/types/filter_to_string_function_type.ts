/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from './filter_ast_node';
import {FilterExpressionType} from './filter_type';

export type FilterToStringFunctionType = (
  root: FilterASTNode,
  type: FilterExpressionType
) => string;
