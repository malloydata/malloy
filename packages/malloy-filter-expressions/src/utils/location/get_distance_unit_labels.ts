/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
export const getDistanceUnitLabels = (unit: string) => {
  switch (unit) {
    case 'feet':
      return 'feet';
    case 'kilometers':
      return 'kilometers';
    case 'meters':
      return 'meters';
    case 'miles':
      return 'miles';
  }
  return '';
};
