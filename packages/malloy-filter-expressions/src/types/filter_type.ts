/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
export type FilterExpressionType =
  | 'number'
  | 'string'
  | 'location'
  | 'date'
  | 'date_time'
  | 'tier';

// The following are the sub-types handled by each type of filter
// any other sub-types will be handled as "matches (advanced)"

export const dateFilterTypes = [
  'null',
  'anyvalue',
  'notnull',
  'past',
  'pastAgo',
  'this',
  'next',
  'last',
  'year',
  'month',
  'before',
  'after',
  'range',
  'thisRange',
  'on',
  'relative',
  'day',
] as const;

export type DateFilterType = (typeof dateFilterTypes)[number];

export const numberFilterTypes = [
  '=',
  '>',
  '<',
  '>=',
  '<=',
  'between',
  'null',
] as const;

export type NumberFilterType = (typeof numberFilterTypes)[number];

export const stringFilterTypes = [
  'null',
  'contains',
  'match',
  'startsWith',
  'endsWith',
  'blank',
] as const;

export type StringFilterType = (typeof stringFilterTypes)[number];

export const tierFilterTypes = ['anyvalue', 'match'] as const;

export type TierFilterType = (typeof tierFilterTypes)[number];

export const locationFilterTypes = [
  'location',
  'circle',
  'box',
  'anyvalue',
  'null',
  'notnull',
] as const;

export type LocationFilterType = (typeof locationFilterTypes)[number];
