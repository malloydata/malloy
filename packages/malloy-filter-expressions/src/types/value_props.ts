/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from './filter_model';

/**
 * Represents the properties of the filter item value components:
 *  equals, greaterThan, lessThan that can be expressed with just a value[]
 */
export interface ValueProps extends FilterModel {
  value: number[];
}
