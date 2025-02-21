import {FilterSerializer} from './filter_serializer';
import {
  NumberClause,
  StringCondition,
  BooleanClause,
  DateClause,
} from './clause_types';

/* eslint-disable no-console */
function aSimpleSerializer() {
  const strings: StringCondition[] = [{operator: '=', values: ['CAT', 'DOG']}];
  let response = new FilterSerializer(strings, 'string').serialize();
  console.log(...strings, '\n', response.result, '\n');

  const numbers: NumberClause[] = [
    {
      operator: 'range',
      startOperator: '>=',
      startValue: -5.5,
      endOperator: '<',
      endValue: 10,
    },
  ];
  response = new FilterSerializer(numbers, 'number').serialize();
  console.log(...numbers, '\n', response.result, '\n');

  const booleans: BooleanClause[] = [{operator: 'NULL'}, {operator: 'TRUE'}];

  response = new FilterSerializer(booleans, 'boolean').serialize();
  console.log(...booleans, '\n', response.result, '\n');

  const dates: DateClause[] = [
    {operator: 'YESTERDAY'},
    {operator: 'NEXT', unit: 'TUESDAY'},
  ];
  response = new FilterSerializer(dates, 'date').serialize();
  console.log(...dates, '\n', response.result, '\n');
}

aSimpleSerializer();
