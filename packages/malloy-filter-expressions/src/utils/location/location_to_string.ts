/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {
  FilterASTNode,
  FilterItemToStringMapType,
  FilterModel,
} from '../../types';
import {treeToString} from '../tree/tree_to_string';

const locationExactToString = ({lat, lon}: FilterModel): string =>
  lat && lon ? `${lat}, ${lon}` : '';

const circleToString = ({distance, unit, lat, lon}: FilterModel): string =>
  distance && unit && lat && lon
    ? `${distance} ${unit} from ${lat}, ${lon}`
    : '';

const boxToString = ({lon, lat, lon1, lat1}: FilterModel): string =>
  lon && lat && lon1 && lat1
    ? `inside box from ${lat}, ${lon} to ${lat1}, ${lon1}`
    : '';

const anyvalue = () => '';

const nullToString = () => 'null';

const notNullToString = () => '-null';

const filterToStringMap: FilterItemToStringMapType = {
  'location': locationExactToString,
  'circle': circleToString,
  'box': boxToString,
  anyvalue,
  'null': nullToString,
  'notnull': notNullToString,
};

const locationToExpression = (item: FilterModel): string => {
  const toStringFunction = filterToStringMap[item.type];
  return toStringFunction?.(item) || '';
};

export const locationToString = (root: FilterASTNode) =>
  treeToString(root, locationToExpression);
