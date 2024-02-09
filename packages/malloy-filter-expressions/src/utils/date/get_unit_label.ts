/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
const getPlural = (unit: string) => {
  // prettier-ignore
  const pluralUnits: { [key: string]: string } = {
    'fiscal year'            : 'fiscal years',
    'year'                     : 'years',
    'fiscal quarter'         : 'fiscal quarters',
    'quarter'                  : 'quarters',
    'month'                    : 'months',
    'week'                     : 'weeks',
    'day'                      : 'days',
    'hour'                     : 'hours',
    'minute'                   : 'minutes',
    'second'                   : 'seconds',
    'complete fiscal year'   : 'complete fiscal years',
    'complete year'          : 'complete years',
    'complete fiscal quarter': 'complete fiscal quarters',
    'complete quarter'       : 'complete quarters',
    'complete month'         : 'complete months',
    'complete week'          : 'complete weeks',
    'complete day'           : 'complete days',
    'complete hour'          : 'complete hours',
    'complete minute'        : 'complete minutes',
    'complete second'        : 'complete seconds',
  }
  return pluralUnits[unit] || unit;
};

const getSingular = (unit: string) => {
  // prettier-ignore
  const pluralUnits: { [key: string]: string } = {
    'fiscal year'            : 'fiscal year',
    'year'                     : 'year',
    'fiscal quarter'         : 'fiscal quarter',
    'quarter'                  : 'quarter',
    'month'                    : 'month',
    'week'                     : 'week',
    'day'                      : 'day',
    'hour'                     : 'hour',
    'minute'                   : 'minute',
    'second'                   : 'second',
    'complete fiscal year'   : 'complete fiscal year',
    'complete year'          : 'complete year',
    'complete fiscal quarter': 'complete fiscal quarter',
    'complete quarter'       : 'complete quarter',
    'complete month'         : 'complete month',
    'complete week'          : 'complete week',
    'complete day'           : 'complete day',
    'complete hour'          : 'complete hour',
    'complete minute'        : 'complete minute',
    'complete second'        : 'complete second',
  }
  return pluralUnits[unit] || unit;
};

export const getUnitLabel = (unit: string, value = 1) =>
  value !== 1 ? getPlural(unit) : getSingular(unit);
