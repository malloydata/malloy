import {
  fnConcat,
  fnFirstValue,
  fnFloor,
  fnIfnull,
  fnLag,
  fnLength,
  fnLower,
  fnRank,
  fnRegexpExtract,
  fnReplace,
  fnRound,
  fnRowNumber,
  fnStddev,
  fnSubstr,
  fnUpper,
  fnFirst,
} from '.';
import {FunctionMap} from './function_map';

export const FUNCTIONS = new FunctionMap();

// Scalar functions
FUNCTIONS.add('concat', fnConcat);
FUNCTIONS.add('round', fnRound);
FUNCTIONS.add('floor', fnFloor);
FUNCTIONS.add('lower', fnLower);
FUNCTIONS.add('upper', fnUpper);
FUNCTIONS.add('substr', fnSubstr);
FUNCTIONS.add('regexp_extract', fnRegexpExtract);
FUNCTIONS.add('replace', fnReplace);
FUNCTIONS.add('length', fnLength);
FUNCTIONS.add('ifnull', fnIfnull);

// Aggregate functions
FUNCTIONS.add('stddev', fnStddev);
FUNCTIONS.add('first', fnFirst);

// Analytic functions
FUNCTIONS.add('row_number', fnRowNumber);
FUNCTIONS.add('lag', fnLag);
FUNCTIONS.add('rank', fnRank);
FUNCTIONS.add('first_value', fnFirstValue);

FUNCTIONS.seal();
