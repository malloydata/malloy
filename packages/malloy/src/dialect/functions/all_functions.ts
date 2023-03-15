import {
  fnConcat,
  fnFloor,
  fnIfnull,
  fnLength,
  fnLower,
  fnRegexpExtract,
  fnReplace,
  fnRound,
  fnStddev,
  fnSubstr,
  fnUpper,
} from '.';
import {FunctionMap} from './function_map';

export const FUNCTIONS = new FunctionMap();
FUNCTIONS.add('concat', fnConcat);
FUNCTIONS.add('stddev', fnStddev);
FUNCTIONS.add('round', fnRound);
FUNCTIONS.add('floor', fnFloor);
FUNCTIONS.add('lower', fnLower);
FUNCTIONS.add('upper', fnUpper);
FUNCTIONS.add('substr', fnSubstr);
FUNCTIONS.add('regexp_extract', fnRegexpExtract);
FUNCTIONS.add('replace', fnReplace);
FUNCTIONS.add('length', fnLength);
FUNCTIONS.add('ifnull', fnIfnull);
FUNCTIONS.seal();
