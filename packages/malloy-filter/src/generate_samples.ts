import {SpecialToken, Tokenizer, TokenizerParams} from './tokenizer';
import {BooleanParser} from './boolean_parser';
import {StringParser} from './string_parser';
import {NumberParser} from './number_parser';
import {DateParser} from './date_parser';
import {BooleanSerializer} from './boolean_serializer';
import {StringSerializer} from './string_serializer';
import {NumberSerializer} from './number_serializer';
import {DateSerializer} from './date_serializer';
import {BooleanClause, NumberClause, StringClause} from './clause_types';
import {DateClause} from './date_types';

type Clause = BooleanClause | DateClause | NumberClause | StringClause;

const numberExamples = [
  '5',
  '!=5',
  '1, 3, null , 7',
  '<1, >=100 ',
  '>=1',
  ' <= 10 ',
  'NULL',
  ' -NULL',
  '(1, 7)',
  '[-5, 90]',
  ' != ( 12, 20 ] ',
  '[.12e-20, 20.0e3)',
  '[0,9],[20,29]',
  '[0,10], 20, NULL, ( 72, 82 ] ',
  ', notanumber,, "null", apple pear orange, nulle, nnull, >=,',
  '[cat, 100], <cat',
  '-5.5 to 10',
];

const stringExamples = [
  'CAT, DOG,mouse ',
  '-CAT,-DOG , -mouse',
  ' CAT,-"DOG",m o u s e',
  '-CAT,-DOG,mouse, bird, zebra, -horse, -goat',
  'Missing ,NULL',
  'CAT%, D%OG, %ous%, %ira_f%, %_oat, ',
  '-CAT%,-D%OG,-%mouse,-%zebra%',
  'CAT%,-CATALOG',
  '%,_,%%,%a%',
  '%\\_X',
  '_\\_X',
  '_CAT,D_G,mouse_',
  '\\_CAT,D\\%G,\\mouse',
  'CAT,-NULL',
  'CAT,-"NULL"',
  'CAT,NULL',
  'EMPTY',
  '-EMPTY',
  'CAT,-EMPTY',
  '"CAT,DOG\',mo`use,zeb\'\'\'ra,g"""t,g\\"ir\\`af\\\'e',
  'CAT\\,DOG',
  'CAT,DOG,-, - ',
  '--CAT,DOG,\\',
  'CAT\\ DOG',
  '_\\_CAT',
  '\\NULL',
  '\\-NULL',
  '-N\\ULL',
  'CA--,D-G', // _ = 'CA--' OR _ = 'D-G'
  ' hello world, foo="bar baz" , qux=quux',
  'one ,Null ,  Empty,E M P T Y Y,EEmpty,        emptIEs',
  '',
];

const booleanExamples = [
  'true',
  'FALSE',
  'null',
  '-NULL',
  ' True , faLSE,NULl,-null',
  "-'null'",
  '10',
  'nnull',
  ' truee ',
];

const dateExamples = [
  'this month',
  '3 days',
  '3 days ago',
  '3 months ago for 2 days',
  'after 2025 seconds',
  '2025 weeks ago',
  'before 3 days ago',
  'before 2025-08-30 08:30:20',
  'after 2025-10-05',
  '2025-08-30 12:00 to 2025-09-18 14:30',
  'this year',
  'next tuesday',
  '7 years from now',
  '2025-01-01 12:00:00 for 3 days',
  '2020-08-12',
  '2020-08',
  'today',
  'yesterday',
  'tomorrow',
  'TODay,Yesterday, TOMORROW , ,TODay ,,',
  '2010 to 2011, 2015 to 2016 , 2018, 2020 ',
  'next week',
  'now',
  'now to next month',
  ' yyesterday ', // Typo
  'before', // Bad syntax
  'for', // Bad syntax
  '7', // Bad syntax
  'from now', // Bad syntax
  '2025-12-25 12:32:', // Bad syntax
  '',
];

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */

function testTokenizerSingle(str: string, params: TokenizerParams): void {
  const tokenizer = new Tokenizer(str, params);
  console.log(str, ' -> ', tokenizer.parse(), '\n');
}

function testTokenizerString() {
  // Test string parser tokenizer.  Do not split on whitespace
  const specialSubstrings: SpecialToken[] = [{type: ',', value: ','}];
  const specialWords: SpecialToken[] = [];
  const params: TokenizerParams = {
    trimWordWhitespace: true,
    combineAdjacentWords: true,
    specialSubstrings,
    specialWords,
  };
  const examples = [
    'CAT, DOG,mouse ',
    '-CAT,-DOG , -mouse',
    ' CAT,-"DOG",m o u s e',
    '-CAT,-DOG,mouse, bird, zebra, -horse, -goat',
    'Missing ,NULL',
    'CAT%,D%OG',
    'CAT%,-CATALOG',
    '_CAT,D_G',
    'CAT,-NULL',
    'CAT,-"NULL"',
    'EMPTY',
    '-EMPTY',
    'CAT,-EMPTY',
    '"CAT,DOG"',
    'CAT\\,DOG',
    'CAT,DOG,-, - ',
    '--CAT,DOG,\\',
    'CA--,D-G', // _ = 'CA--' OR _ = 'D-G'
    ' hello world, foo="bar baz" , qux=quux',
    'one ,Null ,  Empty,E M P T Y Y,EEmpty,        emptIEs',
    '',
  ];
  for (const example of examples) {
    testTokenizerSingle(example, params);
  }
}

function testTokenizerNumber() {
  // Test number parser tokenizer, split on whitespace
  const specialSubstrings: SpecialToken[] = [
    {type: ',', value: ','},
    {type: '[', value: '['},
    {type: ']', value: ']'},
    {type: '(', value: '('},
    {type: ')', value: ')'},
    {type: '<=', value: '<='},
    {type: '>=', value: '>='},
    {type: '!=', value: '!='},
    {type: '=', value: '='},
    {type: '>', value: '>'},
    {type: '<', value: '<'},
  ];
  const specialWords: SpecialToken[] = [
    {type: 'TO', value: 'to', ignoreCase: true},
    {type: '-NULL', value: '-null', ignoreCase: true},
    {type: 'NULL', value: 'null', ignoreCase: true},
  ];
  const params: TokenizerParams = {
    trimWordWhitespace: true,
    combineAdjacentWords: false,
    splitOnWhitespace: true,
    specialSubstrings,
    specialWords,
  };
  const examples = [
    '5',
    '!=5',
    '1, 3, null , 7',
    '<1, >=100 ',
    '-5.5 to 10',
    '>=1',
    ' <= 10 ',
    'NULL',
    ' -NULL',
    '(1, 7)',
    '[-5, 90]',
    ' ( 12, 20 ] ',
    '[.12e-20, 20.0e3)',
    '[0,9],[20,29]',
    '[0,10], 20, NULL, ( 72, 82 ] ',
    ', notanumber,, -"-null", apple pear orange, nulle, nnull',
  ];
  for (const example of examples) {
    testTokenizerSingle(example, params);
  }
}

function testNumberParserSingle(
  str: string,
  outputFormatter?: (clauses: Clause[]) => string
): void {
  console.log('Input: ', str);
  const parser = new NumberParser(str);
  const response = parser.parse();
  // console.log('Tokens: ', parser.getTokens());
  if (response.clauses && response.clauses.length > 0) {
    if (outputFormatter) {
      console.log('Output: ', outputFormatter(response.clauses));
    } else {
      console.log('Output: ', ...response.clauses);
    }
  }
  if (response.errors && response.errors.length > 0) {
    console.log('Errors: ', ...response.errors);
  }
  console.log('');
}

function testNumberParser() {
  for (const example of numberExamples) {
    testNumberParserSingle(example);
  }
}

function testStringParserSingle(
  str: string,
  outputFormatter?: (clauses: Clause[]) => string
): void {
  console.log('Input: ', str);
  const parser = new StringParser(str);
  const response = parser.parse();
  // console.log('Tokens: ', parser.getTokens());
  if (response.clauses && response.clauses.length > 0) {
    if (outputFormatter) {
      console.log('Output: ', outputFormatter(response.clauses));
    } else {
      console.log('Output: ', ...response.clauses);
    }
  }
  if (response.errors && response.errors.length > 0) {
    console.log('Errors: ', ...response.errors);
  }
  console.log('');
}

function testStringParser() {
  for (const example of stringExamples) {
    const parser = new StringParser(example);
    testStringParserSingle(example);
  }
}

function testBooleanParserSingle(
  str: string,
  outputFormatter?: (clauses: Clause[]) => string
): void {
  console.log('Input: ', str);
  const parser = new BooleanParser(str);
  const response = parser.parse();
  // console.log('Tokens: ', parser.getTokens());
  if (response.clauses && response.clauses.length > 0) {
    if (outputFormatter) {
      console.log('Output: ', outputFormatter(response.clauses));
    } else {
      console.log('Output: ', ...response.clauses);
    }
  }
  if (response.errors && response.errors.length > 0) {
    console.log('Errors: ', ...response.errors);
  }
  console.log('');
}

function testBooleanParser() {
  for (const example of booleanExamples) {
    const parser = new BooleanParser(example);
    testBooleanParserSingle(example);
  }
}

function jsonFormatter(clauses: Clause[]): string {
  let str = '';
  for (const clause of clauses) {
    str += JSON.stringify(clause, null, ' ');
  }
  return str;
}

function testDateParserSingle(
  str: string,
  outputFormatter?: (clauses: Clause[]) => string
): void {
  console.log('Input: ', str);
  const parser = new DateParser(str);
  const response = parser.parse();
  // console.log('Tokens: ', parser.getTokens());
  if (response.clauses && response.clauses.length > 0) {
    if (outputFormatter) {
      console.log('Output: ', outputFormatter(response.clauses));
    } else {
      console.log('Output: ', ...response.clauses);
    }
  }
  if (response.errors && response.errors.length > 0) {
    console.log('Errors: ', ...response.errors);
  }
  console.log('');
}

function testDateParser() {
  for (const example of dateExamples) {
    const parser = new DateParser(example);
    testDateParserSingle(example);
  }
}

function testNumberRoundtrip(str: string): void {
  console.log('Input:  ' + str);
  const response = new NumberParser(str).parse();
  // console.log('Clause: ', ...response.clauses, '\n');
  if (response.clauses && response.clauses.length > 0) {
    const result = new NumberSerializer(response.clauses || []).serialize();
    console.log('Output: ' + result);
  }
  if (response.errors && response.errors.length > 0) {
    console.log('Errors: ', ...response.errors);
  }
  console.log('');
}

function testNumberSerializer(): void {
  for (const example of numberExamples) {
    testNumberRoundtrip(example);
  }
}

function testStringRoundtrip(str: string): void {
  console.log('Input:  ' + str);
  const response = new StringParser(str).parse();
  // console.log('Clause: ', ...response.clauses, '\n');
  if (response.clauses && response.clauses.length > 0) {
    const result = new StringSerializer(response.clauses || []).serialize();
    console.log('Output: ' + result);
  }
  if (response.errors && response.errors.length > 0) {
    console.log('Errors: ', ...response.errors);
  }
  console.log('');
}

function testStringSerializer(): void {
  for (const example of stringExamples) {
    testStringRoundtrip(example);
  }
}

function testBooleanRoundtrip(str: string): void {
  console.log('Input:  ' + str);
  const response = new BooleanParser(str).parse();
  // console.log('Clause: ', ...response.clauses, '\n');
  if (response.clauses && response.clauses.length > 0) {
    const result = new BooleanSerializer(response.clauses || []).serialize();
    console.log('Output: ' + result);
  }
  if (response.errors && response.errors.length > 0) {
    console.log('Errors: ', ...response.errors);
  }
  console.log('');
}

function testBooleanSerializer(): void {
  const examples = [[{operator: 'TRUE'}]];
  for (const example of booleanExamples) {
    testBooleanRoundtrip(example);
  }
}

function testDateRoundtrip(str: string): void {
  console.log('Input:  ' + str);
  const response = new DateParser(str).parse();
  // console.log('Clause: ', ...response.clauses, '\n');
  if (response.clauses && response.clauses.length > 0) {
    const result = new DateSerializer(response.clauses || []).serialize();
    console.log('Output: ' + result);
  }
  if (response.errors && response.errors.length > 0) {
    console.log('Errors: ', ...response.errors);
  }
  console.log('');
}

function testDateSerializer(): void {
  for (const example of dateExamples) {
    testDateRoundtrip(example);
  }
}

function printHeader(title: string): void {
  console.log(
    '\n-------------------------------------------------------------------------'
  );
  console.log('## ', title, '\n');
}

// Comment or uncomment the following function calls to disable/enable examples.
function generateSamples() {
  try {
    //printHeader('Tokenizer');
    //testTokenizerString();
    //testTokenizerNumber();
    //testTokenizerMatchTypes();
    printHeader('Numbers');
    testNumberParser();
    printHeader('Strings');
    testStringParser();
    printHeader('Booleans');
    testBooleanParser();
    printHeader('Dates and Times');
    testDateParser();
    printHeader('Number Serializer');
    testNumberSerializer();
    printHeader('String Serializer');
    testStringSerializer();
    printHeader('Boolean Serializer');
    testBooleanSerializer();
    printHeader('Date and Time Serializer');
    testDateSerializer();
  } catch (ex: Error | unknown) {
    if (ex instanceof Error) console.error('Thrown Error: ', ex.message);
    else {
      console.error('Thrown Unknown error: ', ex);
    }
  }
}

generateSamples();
