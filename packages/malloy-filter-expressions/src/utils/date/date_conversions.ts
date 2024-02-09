/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterDateTimeModel} from '../../types';

export const dateToFilterDateTimeModel = (date: Date = new Date()) => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
  hour: date.getHours(),
  minute: date.getMinutes(),
  second: date.getSeconds(),
});

export const filterDateTimeModelToDate = ({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
}: FilterDateTimeModel) => new Date(year, month - 1, day, hour, minute, second);

export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Removes time (hour, minute and second) part from the filter date time model.
 * @param model The filter date time model to remove time part from.
 */
export const clearTimeFilterDateTimeModel = (model: FilterDateTimeModel) => ({
  year: model.year,
  month: model.month,
  day: model.day,
});

/**
 * Returns true if model has defined time (hour, minute and second) part.
 * @param model The filter date time model to check defined time part from.
 */
export const hasTimeFilterDateTimeModel = (
  model: FilterDateTimeModel | undefined
) =>
  model !== undefined &&
  model.hour !== undefined &&
  model.minute !== undefined &&
  model.second !== undefined;
