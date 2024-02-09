/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../../types';

export const convertTypeToOption = ({is, type}: FilterModel) =>
  is ? type : `!${type}`;
