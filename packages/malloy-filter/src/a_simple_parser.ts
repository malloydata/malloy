import {BooleanParser} from './boolean_parser';
import {StringParser} from './string_parser';
import {NumberParser} from './number_parser';
import {DateParser} from './date_parser';

/* eslint-disable no-console */
function aSimpleParser() {
  let str = 'CAT,DOG';
  const stringResponse = new StringParser(str).parse();
  console.log(str, '\n', ...stringResponse.clauses, '\n');

  str = '-5.5, 10, 2.3e7';
  const numberResponse = new NumberParser(str).parse();
  console.log(str, '\n', ...numberResponse.clauses, '\n');

  str = 'null, false';
  const booleanResponse = new BooleanParser(str).parse();
  console.log(str, '\n', ...booleanResponse.clauses, '\n');

  str = 'after 2025-10-05';
  const dateResponse = new DateParser(str).parse();
  console.log(str, '\n', ...dateResponse.clauses, '\n');
}

aSimpleParser();
