/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// import * as fs from 'fs';
// import {BooleanParser} from './boolean_parser';
// import {StringParser} from './string_filter_expression';
// import {NumberParser} from './number_parser';
// import {DateParser} from './date_parser';
// import {BooleanSerializer} from './boolean_serializer';
// import {StringSerializer} from './string_serializer';
// import {NumberSerializer} from './number_serializer';
// import {DateSerializer} from './date_serializer';

// const numberExamples = [
//   '5',
//   '!=5',
//   '1, 3, 5, null',
//   '1, 3, , 5,',
//   '<1, >=100 ',
//   '>=1',
//   ' <= 10 ',
//   'NULL',
//   ' -NULL',
//   '(1, 7)',
//   '[-5, 90]',
//   ' != ( 12, 20 ] ',
//   '[.12e-20, 20.0e3)',
//   '[0,9],[20,29]',
//   '[0,10], 20, NULL, ( 72, 82 ] ',
//   ', notanumber,, "null", apple pear orange, nulle, nnull, >=, a(, |, ), ;',
//   '[cat, 100], <cat',
//   '-5.5 to 10',
// ];

// const stringExamples = [
//   'CAT, DOG,mouse ',
//   '-CAT,-DOG , -mouse',
//   ' CAT,-"DOG",m o u s e',
//   '-CAT,-DOG,mouse, bird, zebra, -horse, -goat',
//   'Missing ,NULL',
//   'CAT%, D%OG, %ous%, %ira_f%, %_oat, ',
//   '-CAT%,-D%OG,-%mouse,-%zebra%',
//   'CAT%,-CATALOG',
//   '%,_,%%,%a%',
//   '%\\_X',
//   '_\\_X',
//   '_CAT,D_G,mouse_',
//   '\\_CAT,D\\%G,\\mouse',
//   'CAT,-NULL',
//   'CAT,-"NULL"',
//   'CAT,NULL',
//   'CAT,,',
//   'CAT, , DOG',
//   'EMPTY',
//   '-EMPTY',
//   'CAT,-EMPTY',
//   '"CAT,DOG\',mo`use,zeb\'\'\'ra,g"""t,g\\"ir\\`af\\\'e',
//   'CAT\\,DOG',
//   'CAT,DOG,-, - ',
//   '--CAT,DOG,\\',
//   'CAT\\ DOG',
//   '_\\_CAT',
//   '\\NULL',
//   '\\-NULL',
//   '-N\\ULL',
//   'CA--,D-G', // _ = 'CA--' OR _ = 'D-G'
//   'Escaped\\;chars\\|are\\(allowed\\)ok',
//   'No(parens, No)parens, No;semicolons, No|ors',
//   ' hello world, foo="bar baz" , qux=quux',
//   'one ,Null ,  Empty,E M P T Y Y,EEmpty,        emptIEs',
//   '',
// ];

// const booleanExamples = [
//   'true',
//   'FALSE',
//   '=false',
//   'null',
//   '-NULL',
//   'null,',
//   ' True , , faLSE,=false,NULl,-null',
//   "-'null'",
//   '10',
//   'nnull',
//   ' truee ',
//   '(true)',
//   'false|true',
// ];

// const dateExamples = [
//   'this month',
//   '3 days',
//   '3 days ago',
//   '3 months ago for 2 days',
//   '2025 weeks ago',
//   'before 3 days ago',
//   'Before 2025-08-30 08:30:20',
//   'AFTER 2025-10-05',
//   '2025-08-30 12:00 to 2025-09-18 14:30',
//   'this YEAR',
//   'Next Tuesday',
//   '7 years from Now',
//   '2025-01-01 12:00:00 for 3 days',
//   '2020-08-12 03:12:56.57',
//   '2020-08-12T03:12:56[PST]',
//   '2020-08-12 03:12:56',
//   '2020-08-12 03:22',
//   '2020-08-12 03',
//   '2020-08-12',
//   '2020-Q3',
//   '2020-08-07-wK',
//   '2020-08',
//   'today',
//   'yesterday',
//   'tomorrow',
//   'TODay,Yesterday, TOMORROW , ,TODay ,,',
//   '2010 to 2011, 2015 to 2016 , 2018, 2020 ',
//   'next week',
//   'now',
//   'now to next month',
//   'null',
//   '-null,',
//   ' yyesterday ', // Typo
//   'before', // Bad syntax
//   'for', // Bad syntax
//   '12', // Bad syntax
//   'from now', // Bad syntax
//   '2025-12-25 12:32:', // Bad syntax
//   '12:22',
//   'after 2025 seconds', // Bad syntax
//   '(2025)',
//   '',
// ];

// /* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable no-console */
// /* eslint-disable @typescript-eslint/no-explicit-any */

// class GenerateSamples {
//   public samplesFile: fs.WriteStream = fs.createWriteStream('dist/SAMPLES.md');
//   public serializedFile: fs.WriteStream = fs.createWriteStream(
//     'dist/SERIALIZE_SAMPLES.md'
//   );
//   constructor() {}

//   private static removeQuotes(word: string) {
//     if (word.startsWith('"')) {
//       word = word.substring(1);
//     }
//     if (word.endsWith('"')) {
//       word = word.substring(0, word.length - 1);
//     }
//     return word;
//   }

//   private static writeJson(
//     fp: fs.WriteStream,
//     title: string,
//     ...args: any[]
//   ): void {
//     const result: string[] = args.map(str => JSON.stringify(str));
//     const result2: string[] = result.map(str =>
//       GenerateSamples.removeQuotes(str)
//     );
//     fp.write(title + ' ' + result2.join(' ') + '\n');
//     console.log(title, ...args);
//   }

//   public static writeRaw(fp: fs.WriteStream, ...args: any[]): void {
//     fp.write(args.join(' ') + '\n');
//     console.log(...args);
//   }

//   public booleanSample(str: string, fp: fs.WriteStream): void {
//     GenerateSamples.writeRaw(fp, 'Input: ', str);
//     const parser = new BooleanParser(str);
//     const response = parser.parse();
//     // GenerateSamples.writeJson(fp, 'Tokens: ', parser.getTokens());
//     if (response.clauses && response.clauses.length > 0) {
//       GenerateSamples.writeJson(fp, 'Output: ', ...response.clauses);
//     }
//     if (response.logs && response.logs.length > 0) {
//       GenerateSamples.writeJson(fp, 'Logs:   ', ...response.logs);
//     }
//     GenerateSamples.writeRaw(fp, '');
//   }

//   public dateSample(str: string, fp: fs.WriteStream): void {
//     GenerateSamples.writeRaw(fp, 'Input: ', str);
//     const parser = new DateParser(str);
//     const response = parser.parse();
//     // GenerateSamples.writeJson(fp, 'Tokens: ', parser.getTokens());
//     if (response.clauses && response.clauses.length > 0) {
//       GenerateSamples.writeJson(fp, 'Output: ', ...response.clauses);
//     }
//     if (response.logs && response.logs.length > 0) {
//       GenerateSamples.writeJson(fp, 'Logs:   ', ...response.logs);
//     }
//     GenerateSamples.writeRaw(fp, '');
//   }

//   public numberSample(str: string, fp: fs.WriteStream): void {
//     GenerateSamples.writeRaw(fp, 'Input: ', str);
//     const parser = new NumberParser(str);
//     const response = parser.parse();
//     // GenerateSamples.writeJson(fp, 'Tokens: ', parser.getTokens());
//     if (response.clauses && response.clauses.length > 0) {
//       GenerateSamples.writeJson(fp, 'Output: ', ...response.clauses);
//     }
//     if (response.logs && response.logs.length > 0) {
//       GenerateSamples.writeJson(fp, 'Logs:   ', ...response.logs);
//     }
//     GenerateSamples.writeRaw(fp, '');
//   }

//   public stringSample(str: string, fp: fs.WriteStream): void {
//     GenerateSamples.writeRaw(fp, 'Input: ', str);
//     const parser = new StringParser(str);
//     const response = parser.parse();
//     // GenerateSamples.writeJson(fp, 'Tokens: ', parser.getTokens());
//     if (response.clauses && response.clauses.length > 0) {
//       GenerateSamples.writeJson(fp, 'Output: ', ...response.clauses);
//     }
//     if (response.logs && response.logs.length > 0) {
//       GenerateSamples.writeJson(fp, 'Logs:   ', ...response.logs);
//     }
//     GenerateSamples.writeRaw(fp, '');
//   }

//   public booleanSerialized(str: string, fp: fs.WriteStream): void {
//     GenerateSamples.writeRaw(fp, 'Input:  ' + str);
//     const response = new BooleanParser(str).parse();
//     // this.writeJson('Clause: ', ...response.clauses, '\n');
//     if (response.clauses && response.clauses.length > 0) {
//       const result = new BooleanSerializer(response.clauses || []).serialize();
//       GenerateSamples.writeRaw(fp, 'Output: ' + result);
//     }
//     if (response.logs && response.logs.length > 0) {
//       GenerateSamples.writeJson(fp, 'Logs:   ', ...response.logs);
//     }
//     GenerateSamples.writeRaw(fp, '');
//   }

//   public dateSerialized(str: string, fp: fs.WriteStream): void {
//     GenerateSamples.writeRaw(fp, 'Input:  ' + str);
//     const response = new DateParser(str).parse();
//     // this.writeJson('Clause: ', ...response.clauses, '\n');
//     if (response.clauses && response.clauses.length > 0) {
//       const result = new DateSerializer(response.clauses || []).serialize();
//       GenerateSamples.writeRaw(fp, 'Output: ' + result);
//     }
//     if (response.logs && response.logs.length > 0) {
//       GenerateSamples.writeJson(fp, 'Logs:   ', ...response.logs);
//     }
//     GenerateSamples.writeRaw(fp, '');
//   }

//   public numberSerialized(str: string, fp: fs.WriteStream): void {
//     GenerateSamples.writeRaw(fp, 'Input:  ' + str);
//     const response = new NumberParser(str).parse();
//     // this.writeJson('Clause: ', ...response.clauses, '\n');
//     if (response.clauses && response.clauses.length > 0) {
//       const result = new NumberSerializer(response.clauses || []).serialize();
//       GenerateSamples.writeRaw(fp, 'Output: ' + result);
//     }
//     if (response.logs && response.logs.length > 0) {
//       GenerateSamples.writeJson(fp, 'Logs:   ', ...response.logs);
//     }
//     GenerateSamples.writeRaw(fp, '');
//   }

//   public stringSerialized(str: string, fp: fs.WriteStream): void {
//     GenerateSamples.writeRaw(fp, 'Input:  ' + str);
//     const response = new StringParser(str).parse();
//     // this.writeJson('Clause: ', ...response.clauses, '\n');
//     if (response.clauses && response.clauses.length > 0) {
//       const result = new StringSerializer(response.clauses || []).serialize();
//       GenerateSamples.writeRaw(fp, 'Output: ' + result);
//     }
//     if (response.logs && response.logs.length > 0) {
//       GenerateSamples.writeJson(fp, 'Logs:   ', ...response.logs);
//     }
//     GenerateSamples.writeRaw(fp, '');
//   }

//   public loop(
//     title: string,
//     examples: string[],
//     func: (str: string, fp: fs.WriteStream) => void,
//     fp: fs.WriteStream
//   ): void {
//     GenerateSamples.writeRaw(
//       fp,
//       '-------------------------------------------------------------------------'
//     );
//     GenerateSamples.writeRaw(fp, '## ' + title + '\n');
//     GenerateSamples.writeRaw(fp, '```code');
//     for (const example of examples) {
//       func(example, fp);
//     }
//     GenerateSamples.writeRaw(fp, '```\n');
//   }
// }

// // Comment or uncomment the following function calls to disable/enable examples.
// function generateSamples() {
//   try {
//     const gen = new GenerateSamples();
//     GenerateSamples.writeRaw(
//       gen.samplesFile,
//       `
// # Parsers

// Each filter type is handled by a different parser (strings, numbers, dates and times, etc).
// Sample outputs from each parser follow...
// `
//     );

//     GenerateSamples.writeRaw(
//       gen.serializedFile,
//       `
// # Serializers

// Each parser has a complementary serializer that converts the structured clause list back
// to string format.  Below are round-trip samples: \`string\` to \`Clause[]\` back to \`string\`.
// Round-trip Examples:

// \`\`\`code
//     Input  >  parse  >  Clause[]  >  serialize  >  Output
//     string                                         string
// \`\`\`
// `
//     );
//     gen.loop('Numbers', numberExamples, gen.numberSample, gen.samplesFile);
//     gen.loop('Strings', stringExamples, gen.stringSample, gen.samplesFile);
//     gen.loop('Booleans', booleanExamples, gen.booleanSample, gen.samplesFile);
//     gen.loop('Dates and Times', dateExamples, gen.dateSample, gen.samplesFile);
//     gen.loop(
//       'Number Serializer',
//       numberExamples,
//       gen.numberSerialized,
//       gen.serializedFile
//     );
//     gen.loop(
//       'String Serializer',
//       stringExamples,
//       gen.stringSerialized,
//       gen.serializedFile
//     );
//     gen.loop(
//       'Boolean Serializer',
//       booleanExamples,
//       gen.booleanSerialized,
//       gen.serializedFile
//     );
//     gen.loop(
//       'Date Serializer',
//       dateExamples,
//       gen.dateSerialized,
//       gen.serializedFile
//     );
//   } catch (ex: Error | unknown) {
//     if (ex instanceof Error) console.error('Thrown Error: ', ex.message);
//     else {
//       console.error('Thrown Unknown error: ', ex);
//     }
//   }
// }

// generateSamples();
