/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../filter_model';

export interface ExactLocationFilterItem extends FilterModel {
  lat: number;
  lon: number;
}

export interface CircleFilterItem extends ExactLocationFilterItem {
  distance: number;
  unit: string;
}

export interface BoxFilterItem extends ExactLocationFilterItem {
  lat1: number;
  lon1: number;
}
