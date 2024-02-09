/*

 MIT License

 Copyright (c) 2022 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */
import defaultTo from 'lodash/defaultTo';
import {FilterItemToStringMapType, FilterModel} from '../../types';
import {getDistanceUnitLabels} from './get_distance_unit_labels';

const describeLat = (lat: number) => {
  const latAbs = Math.abs(lat).toFixed(1);
  const textNorth = `${latAbs}°N`;
  const textSouth = `${latAbs}°S`;
  return lat > 0 ? textNorth : textSouth;
};

const describeLon = (lon: number) => {
  const lonAbs = Math.abs(lon).toFixed(1);
  const textEast = `${lonAbs}°E`;
  const textWest = `${lonAbs}°W`;
  return lon > 0 ? textEast : textWest;
};

const box = ({lon, lat, lon1, lat1}: FilterModel): string => {
  return lon && lat && lon1 && lat1
    ? `${describeLat(lat)}, ${describeLon(lon)} to ${describeLat(
        lat1
      )}, ${describeLon(lon1)}`
    : '';
};

const circle = ({distance, unit, lat, lon}: FilterModel): string => {
  return distance && unit && lat && lon
    ? `${distance} ${getDistanceUnitLabels(unit)} from ${lat}, ${lon}`
    : '';
};

const location = ({lat, lon}: FilterModel): string =>
  lat && lon ? `${lat}, ${lon}` : '';

const anyvalue = () => {
  return 'is anywhere';
};

const describeNull = () => {
  return 'is null';
};

const describeNotNull = () => {
  return 'is not null';
};

const filterToStringMap: FilterItemToStringMapType = {
  box,
  circle,
  location,
  anyvalue,
  'null': describeNull,
  'notnull': describeNotNull,
};

/**
 * Maps a FilterItem to a function for converting it to a filter summary
 */
export const describeLocation = (item: FilterModel): string =>
  defaultTo(filterToStringMap[item.type], () => '')(item);
