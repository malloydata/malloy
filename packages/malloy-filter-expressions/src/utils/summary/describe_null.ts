/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../../types';
import {describeIsItem} from './describe_is_item';

export const describeNull = ({is}: FilterModel): string =>
  describeIsItem(is, 'null');
