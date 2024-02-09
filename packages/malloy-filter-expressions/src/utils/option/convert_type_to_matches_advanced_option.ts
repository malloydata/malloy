/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../../types';

/*
 * converts filter types to matches (advanced)
 * dateFilter 'day', type 'thisRange', and type 'pastAgo' need to be in the filter list, but we do not want it showing up
 * in the advanced filter options therefore it should be converted to matches (advanced)
 */
export const convertTypeToMatchesAdvancedOption = ({type}: FilterModel) =>
  type === 'day' ||
  type === 'thisRange' ||
  type === 'pastAgo' ||
  type?.startsWith('before_') ||
  type?.startsWith('after_')
    ? 'matchesAdvanced'
    : type;
