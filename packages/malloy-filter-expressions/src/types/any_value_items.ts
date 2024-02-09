/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from './filter_ast_node';

export const anyValue: FilterASTNode = {
  'id': 1,
  'type': 'anyvalue',
  'is': true,
};
export const anyNumberItem: FilterASTNode = {
  'id': 1,
  'type': '=',
  'value': [],
  'is': true,
};
export const anyStringItem: FilterASTNode = {
  'id': 1,
  'type': 'match',
  'value': [],
  'is': true,
};
