/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {GrammarTestItem} from '.';

const parameterField = {
  has_allowed_values: true,
  parameter: true,
  enumerations: [
    {
      label: 'first item',
      value: 'first item',
    },
    {
      label: 'sub_region',
      value: 'sub^_region',
    },
  ],
};

export const tierGrammarTestItems: GrammarTestItem = [
  {
    expression: '20 to 29',
    describe: 'is 20 to 29',
    type: 'match',
    output: '20 to 29',
  },

  // can parse an escaped parameter field expression
  {
    expression: 'sub^_region',
    describe: 'is sub_region',
    type: 'match',
    output: '"sub_region"',
    // add parameter field to match value with enumeration options
    field: parameterField,
  },
];
