import {Clause} from './clause_types';
import {SpecialToken, Tokenizer, TokenizerParams} from './tokenizer';
import {BooleanParser} from './boolean_parser';
import {StringParser} from './string_parser';
import {NumberParser} from './number_parser';
import {DateParser} from './date_parser';
import {BaseParser} from './base_parser';
import {BooleanSerializer} from './boolean_serializer';
import {StringSerializer} from './string_serializer';
import {NumberSerializer} from './number_serializer';
import {DateSerializer} from './date_serializer';
import {BaseSerializer} from './base_serializer';
import {Token} from './token_types';

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
  '2025-08-30 12:00:00 to 2025-09-18 14:00:00',
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
  '',
];

function testTokenizerSingle(str: string, params: TokenizerParams): void {
  const tokenizer = new Tokenizer(str, params);
  console.log(str, ' -> ', tokenizer.parse(), '\n');
}

function testTokenizerString() {
  // Test string parser tokenizer.  Do not split on whitespace
  let specialSubstrings: SpecialToken[] = [{type: ',', value: ','}];
  let specialWords: SpecialToken[] = [];
  let params: TokenizerParams = {
    trimWordWhitespace: true,
    combineAdjacentWords: true,
    specialSubstrings,
    specialWords,
  };
  let examples = [
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
  let specialSubstrings: SpecialToken[] = [
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
  let specialWords: SpecialToken[] = [
    {type: 'TO', value: 'to', ignoreCase: true},
    {type: '-NULL', value: '-null', ignoreCase: true},
    {type: 'NULL', value: 'null', ignoreCase: true},
  ];
  let params: TokenizerParams = {
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

function testTokenizerMatchTypes() {
  const tokens: Token[] = [
    {type: 'word', value: 'hello', startIndex: 0, endIndex: 5},
    {type: 'punctuation', value: ',', startIndex: 5, endIndex: 6},
    {type: 'word', value: 'world', startIndex: 6, endIndex: 10},
  ];

  console.log(Tokenizer.matchTypes('word|punctuation|word', tokens, 0)); // Output: true
  console.log(Tokenizer.matchTypes('word|word|word', tokens, 0)); // Output: false
  console.log(Tokenizer.matchTypes('word|punctuation|word', tokens, 1)); // Output: false
}

function testParserSingle(
  str: string,
  parser: BaseParser,
  outputFormatter?: (clauses: Clause[]) => string
): void {
  console.log('Input: ', str);
  try {
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
  } catch (ex: Error | unknown) {
    if (ex instanceof Error) console.error('Thrown Error: ', ex.message);
    else {
      console.error('Thrown Unknown error: ', ex);
    }
  }
  console.log('');
}

function testSerializerRoundtrip(
  str: string,
  parser: BaseParser,
  serializerFunc: (clauses: Clause[]) => BaseSerializer
): void {
  console.log('Input:  ' + str);
  try {
    const response = parser.parse();
    // console.log('Clause: ', ...response.clauses, '\n');
    if (response.clauses && response.clauses.length > 0) {
      const result = serializerFunc(response.clauses || []).serialize();
      console.log('Output: ' + result);
    }
    if (response.errors && response.errors.length > 0) {
      console.log('Errors: ', ...response.errors);
    }
  } catch (ex: Error | unknown) {
    if (ex instanceof Error) console.error('Thrown Error: ', ex.message);
    else {
      console.error('Thrown Unknown error: ', ex);
    }
  }
  console.log('');
}

function testNumberParser() {
  for (const example of numberExamples) {
    const parser = new NumberParser(example);
    testParserSingle(example, parser);
  }
}

function testStringParser() {
  for (const example of stringExamples) {
    const parser = new StringParser(example);
    testParserSingle(example, parser);
  }
}

function testBooleanParser() {
  for (const example of booleanExamples) {
    const parser = new BooleanParser(example);
    testParserSingle(example, parser);
  }
}

function jsonFormatter(clauses: Clause[]): string {
  let str = '';
  for (const clause of clauses) {
    str += JSON.stringify(clause, null, ' ');
  }
  return str;
}

function testDateParser() {
  for (const example of dateExamples) {
    const parser = new DateParser(example);
    testParserSingle(example, parser);
    //testParserSingle(example, parser, jsonFormatter);
  }
}

function testNumberSerializer(): void {
  const examples = [
    [{operator: '>', value: 10}],
    [{startOperator: '>=', startValue: 20, endOperator: '<=', endValue: 30}],
  ];
  for (const example of numberExamples) {
    testSerializerRoundtrip(
      example,
      new NumberParser(example),
      clauses => new NumberSerializer(clauses)
    );
  }
}

function testStringSerializer(): void {
  for (const example of stringExamples) {
    testSerializerRoundtrip(
      example,
      new StringParser(example),
      clauses => new StringSerializer(clauses)
    );
  }
}

function testBooleanSerializer(): void {
  const examples = [[{operator: 'TRUE'}]];
  for (const example of booleanExamples) {
    testSerializerRoundtrip(
      example,
      new BooleanParser(example),
      clauses => new BooleanSerializer(clauses)
    );
  }
}

function testDateSerializer(): void {
  const examples = [
    [{prefix: 'BEFORE', values: [{type: 'day', value: 'yesterday'}]}],
    [
      {
        start: [{type: 'day', value: 'today'}],
        operator: 'TO',
        end: [{type: 'day', value: 'tomorrow'}],
      },
    ],
    [{type: 'day', value: 'today'}],
  ];
  for (const example of dateExamples) {
    testSerializerRoundtrip(
      example,
      new DateParser(example),
      clauses => new DateSerializer(clauses)
    );
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
  //printHeader('Tokenizer');
  //testTokenizerString();
  //testTokenizerNumber();
  //testTokenizerMatchTypes();
  //printHeader('Numbers');
  //testNumberParser();
  //printHeader('Strings');
  //testStringParser();
  //printHeader('Booleans');
  //testBooleanParser();
  //printHeader('Dates and Times');
  //testDateParser();
  printHeader('Number Serializer');
  testNumberSerializer();
  printHeader('String Serializer');
  testStringSerializer();
  printHeader('Boolean Serializer');
  testBooleanSerializer();
  printHeader('Date and Time Serializer');
  testDateSerializer();
}

generateSamples();
