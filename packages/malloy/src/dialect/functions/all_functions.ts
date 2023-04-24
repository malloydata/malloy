import {
  fnConcat,
  fnFirstValueWindow,
  fnLastValueWindow,
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
  fnChr,
  fnNullif,
  fnTrunc,
  fnCeil,
  fnCos,
  fnCosh,
  fnAcos,
  fnAcosh,
  fnSin,
  fnSinh,
  fnAsin,
  fnAsinh,
  fnTan,
  fnTanh,
  fnAtan,
  fnAtanh,
  fnAtan2,
  fnAbs,
  fnSign,
  fnIsInf,
  fnIsNan,
  fnSqrt,
  fnPow,
  fnGreatest,
  fnLeast,
  fnDiv,
  fnStrpos,
  fnByteLength,
  fnEndsWith,
  fnStartsWith,
  fnTrim,
  fnLtrim,
  fnRtrim,
  fnNumNulls,
  fnNumNonNulls,
  fnRand,
  fnPi,
  fnAscii,
  fnFormat,
  fnReverse,
  fnRepeat,
  fnUnicode,
  fnToHex,
  fnMinWindow,
  fnSumWindow,
  fnMaxWindow,
  fnMinCumulative,
  fnSumCumulative,
  fnMaxCumulative,
  fnLead,
} from './functions_index';
import {FunctionMap} from './function_map';

export const FUNCTIONS = new FunctionMap();

// Scalar functions
FUNCTIONS.add('concat', fnConcat);
FUNCTIONS.add('round', fnRound);
FUNCTIONS.add('trunc', fnTrunc);
FUNCTIONS.add('floor', fnFloor);
FUNCTIONS.add('ceil', fnCeil);
FUNCTIONS.add('cos', fnCos);
FUNCTIONS.add('cosh', fnCosh);
FUNCTIONS.add('acos', fnAcos);
FUNCTIONS.add('acosh', fnAcosh);
FUNCTIONS.add('sin', fnSin);
FUNCTIONS.add('sinh', fnSinh);
FUNCTIONS.add('asin', fnAsin);
FUNCTIONS.add('asinh', fnAsinh);
FUNCTIONS.add('tan', fnTan);
FUNCTIONS.add('tanh', fnTanh);
FUNCTIONS.add('atan', fnAtan);
FUNCTIONS.add('atanh', fnAtanh);
FUNCTIONS.add('atan2', fnAtan2);
FUNCTIONS.add('lower', fnLower);
FUNCTIONS.add('upper', fnUpper);
FUNCTIONS.add('sqrt', fnSqrt);
FUNCTIONS.add('pow', fnPow);
FUNCTIONS.add('abs', fnAbs);
FUNCTIONS.add('sign', fnSign);
FUNCTIONS.add('is_inf', fnIsInf);
FUNCTIONS.add('is_nan', fnIsNan);
FUNCTIONS.add('greatest', fnGreatest);
FUNCTIONS.add('least', fnLeast);
FUNCTIONS.add('div', fnDiv);
FUNCTIONS.add('strpos', fnStrpos);
FUNCTIONS.add('starts_with', fnStartsWith);
FUNCTIONS.add('ends_with', fnEndsWith);
FUNCTIONS.add('trim', fnTrim);
FUNCTIONS.add('ltrim', fnLtrim);
FUNCTIONS.add('rtrim', fnRtrim);
FUNCTIONS.add('num_nulls', fnNumNulls);
FUNCTIONS.add('num_nonnulls', fnNumNonNulls);
FUNCTIONS.add('rand', fnRand);
FUNCTIONS.add('pi', fnPi);
FUNCTIONS.add('substr', fnSubstr);
FUNCTIONS.add('regexp_extract', fnRegexpExtract);
FUNCTIONS.add('replace', fnReplace);
FUNCTIONS.add('length', fnLength);
FUNCTIONS.add('byte_length', fnByteLength);
FUNCTIONS.add('ifnull', fnIfnull);
FUNCTIONS.add('nullif', fnNullif);
FUNCTIONS.add('chr', fnChr);
FUNCTIONS.add('ascii', fnAscii);
FUNCTIONS.add('unicode', fnUnicode);
FUNCTIONS.add('format', fnFormat);
FUNCTIONS.add('repeat', fnRepeat);
FUNCTIONS.add('reverse', fnReverse);
FUNCTIONS.add('to_hex', fnToHex);

// Aggregate functions
FUNCTIONS.add('stddev', fnStddev);
FUNCTIONS.add('first', fnFirst);

// Analytic functions
FUNCTIONS.add('row_number', fnRowNumber);
FUNCTIONS.add('lag', fnLag);
FUNCTIONS.add('lead', fnLead);
FUNCTIONS.add('rank', fnRank);
FUNCTIONS.add('first_value', fnFirstValueWindow);
FUNCTIONS.add('last_value', fnLastValueWindow);
FUNCTIONS.add('min_cumulative', fnMinCumulative);
FUNCTIONS.add('max_cumulative', fnMaxCumulative);
FUNCTIONS.add('sum_cumulative', fnSumCumulative);
FUNCTIONS.add('min_window', fnMinWindow);
FUNCTIONS.add('max_window', fnMaxWindow);
FUNCTIONS.add('sum_window', fnSumWindow);

FUNCTIONS.seal();
