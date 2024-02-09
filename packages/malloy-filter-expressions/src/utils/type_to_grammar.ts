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
import {
  dateGrammar,
  locationGrammar,
  numberGrammar,
  stringGrammar,
  tierGrammar,
} from '../grammars';
import {
  anyNumberItem,
  anyStringItem,
  anyValue,
  dateFilterTypes,
  locationFilterTypes,
  numberFilterTypes,
  stringFilterTypes,
  tierFilterTypes,
  FilterASTNode,
  FilterItemToStringFunction,
  FilterToStringFunctionType,
  FilterExpressionType,
  TransformFunction,
} from '../types';
import {dateFilterToString} from './date/date_filter_to_string';
import {describeDate} from './date/describe_date';
import {describeLocation} from './location/describe_location';
import {locationToString} from './location/location_to_string';
import {describeNumber} from './number/describe_number';
import {numberToString} from './number/number_to_string';
import {describeString} from './string/describe_string';
import {stringFilterToString} from './string/string_filter_to_string';
import {describeTier} from './tier/describe_tier';
import {tierFilterToString} from './tier/tier_filter_to_string';
import {numberTransform} from './transform/numberTransform';
import {stringTransform} from './transform/stringTransform';

interface GrammarMapTypeOptions {
  grammar: string;
  toString: FilterToStringFunctionType;
  transform?: TransformFunction;
  describe: FilterItemToStringFunction;
  anyvalue: FilterASTNode;
  subTypes: readonly string[];
}

type GrammarMapType = {
  [K in FilterExpressionType]: GrammarMapTypeOptions;
};

/**
 * A map of available filter types and the grammar properties needed to parse and display
 */
const dateGrammarOptions: GrammarMapTypeOptions = {
  grammar: dateGrammar,
  toString: dateFilterToString,
  describe: describeDate,
  anyvalue: anyValue,
  subTypes: dateFilterTypes,
};

export const grammarsMap: GrammarMapType = {
  date: dateGrammarOptions,
  date_time: dateGrammarOptions,
  number: {
    grammar: numberGrammar,
    toString: numberToString,
    transform: numberTransform,
    describe: describeNumber,
    anyvalue: anyNumberItem,
    subTypes: numberFilterTypes,
  },
  string: {
    grammar: stringGrammar,
    toString: stringFilterToString,
    transform: stringTransform,
    describe: describeString,
    anyvalue: anyStringItem,
    subTypes: stringFilterTypes,
  },
  tier: {
    grammar: tierGrammar,
    toString: tierFilterToString,
    transform: stringTransform,
    describe: describeTier,
    anyvalue: anyStringItem,
    subTypes: tierFilterTypes,
  },
  location: {
    grammar: locationGrammar,
    toString: locationToString,
    describe: describeLocation,
    anyvalue: anyValue,
    subTypes: locationFilterTypes,
  },
};

export const typeToGrammar = (type: FilterExpressionType) =>
  grammarsMap[type] || {};
