/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import any from 'lodash/fp/any';
import flow from 'lodash/fp/flow';
import {FilterModel} from '../types';
import {treeToList} from './tree';

const isMatchesAdvancedItem =
  (subTypes: readonly string[]) =>
  ({type}: FilterModel) =>
    type === 'matchesAdvanced' || subTypes.indexOf(type) === -1;

/**
 * checks if the ast has:
 * - any node that displays as MatchesAdvanced
 * - any node of type 'matchesAdvanced'
 */
export const hasMatchesAdvancedNode = (subTypes: readonly string[]) =>
  flow([treeToList, any(isMatchesAdvancedItem(subTypes))]);
