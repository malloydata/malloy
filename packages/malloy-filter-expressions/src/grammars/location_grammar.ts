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
import {initializer} from './common/initializer';
import {numbers} from './common/numbers';
import {whitespace} from './common/whitespace';

// Location Filter Grammar
// ==========================
//
// Accepts expressions like:
//                           36.97, -122.03
//                           40 miles from 36.97, -122.03
//                           inside box from 72.33, -173.14 to 14.39, -61.70

const grammar = `EXPRESSION
= CIRCLE / LOCATION / BOX / NULLS / ANYWHERE

ANYWHERE = '' {
	return {type:'anywhere'}
}

NULLS = NULL_RULE / NOTNULL

NULL_RULE = NULL {
	return {type: 'null'}
}

NOTNULL = (NOT _ NULL / "-"NULL) {
	return {type: 'notnull'}
}

BOX
= "INSIDE"i _ "BOX"i_ "FROM"i _ from:LOCATION _ "to"i _ to:LOCATION _ {
	return {type:'box', lat: from.lat, lon: from.lon, lat1: to.lat, lon1: to.lon}
}

CIRCLE
= !MINUS distance:DISTANCE _ unit:UNIT _ "from"i _ location:LOCATION {
	return {type: 'circle', distance:distance, unit:unit, lat: location.lat, lon: location.lon }
}

LOCATION = lat:LAT _ COMMA _ lon:LON {
	return { type: 'location', lat:lat, lon:lon }
}

DISTANCE = number {
	var value = parseFloat(text())
	if(value < 0) {
		expected('a positive value')
	}
	return value
}

UNIT = (METERS / FEET / KILOMETERS / MILES)
METERS = "meters"i
FEET = "feet"i
KILOMETERS = "kilometers"i
MILES = "miles"i
NULL = "null"i
NOT = "not"i
MINUS = "-"

LAT = lat:number {
	var value = parseFloat(text())
	if(value < -90 || value > 90) {
		expected('a number between -90 and 90')
	}
	return value
}
LON = number {
	var value = parseFloat(text())
	if(value < -180 || value > 180) {
		expected('a number between -180 and 180')
	}
	return value
}
COMMA = ","
`;

export const locationGrammar = [initializer, grammar, numbers, whitespace].join(
  ''
);
