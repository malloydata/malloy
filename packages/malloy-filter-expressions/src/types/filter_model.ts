/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Interface for the Filter Item properties
 */
export interface FilterModel<T extends string = string> {
  id: string;
  type: T;
  is: boolean;
  date?: FilterDateTimeModel;
  start?: FilterDateTimeModel;
  end?: FilterDateTimeModel;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [propName: string]: any;
}

export interface FilterDateTimeModel {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}
