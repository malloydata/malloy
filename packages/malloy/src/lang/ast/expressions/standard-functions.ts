import {AtomicFieldType} from '../../../model/malloy_types';

type AtomicArgType = AtomicFieldType | 'regular_expression' | 'any';

interface Arg {
  name: string;
  allowedTypes: AtomicArgType[];
  variadic: boolean;
}

interface StandardFunctionInfo {
  args: Arg[];
  returnType: AtomicFieldType;
}

export const standardFunctionInfos: Record<string, StandardFunctionInfo[]> = {};

function register(name: string, ...overloads: StandardFunctionInfo[]) {
  standardFunctionInfos[name] = overloads;
}

function _arg(
  name: string,
  variadic: boolean,
  ...allowedTypes: AtomicArgType[]
): Arg {
  return {
    name: name,
    allowedTypes: allowedTypes,
    variadic: variadic,
  };
}

function arg(name: string, ...allowedTypes: AtomicArgType[]): Arg {
  return _arg(name, false, ...allowedTypes);
}

function vararg(name: string, ...allowedTypes: AtomicArgType[]): Arg {
  return _arg(name, true, ...allowedTypes);
}

function overload(
  returnType: AtomicFieldType,
  ...args: Arg[]
): StandardFunctionInfo {
  return {
    args: args,
    returnType: returnType,
  };
}

register(
  'round',
  overload('number', arg('value', 'number')),
  overload('number', arg('value', 'number'), arg('percision', 'number'))
  // TODO do we want this overload?
  // overload(
  //   "number",
  //   arg("value", "number"),
  //   arg("percision", "number"),
  //   // TODO mode is either ROUND_HALF_AWAY_FROM_ZERO or ROUND_HALF_EVEN
  //   arg("mode", "string")
  // )
);

register(
  'trunc',
  overload('number', arg('value', 'number')),
  overload('number', arg('value', 'number'), arg('percision', 'number'))
);

register('floor', overload('number', arg('value', 'number')));

register('ceil', overload('number', arg('value', 'number')));

for (const func_name of [
  'sin',
  'cos',
  'cosh',
  'acos',
  'acosh',
  'sin',
  'sinh',
  'asin',
  'asinh',
  'tan',
  'tanh',
  'atan',
  'atanh',
  'cot',
  'coth',
]) {
  register(func_name, overload('number', arg('angle_radians', 'number')));
}

register('atan2', overload('number', arg('y', 'number'), arg('x', 'number')));

for (const func_name of ['abs', 'sign', 'sqrt', 'exp', 'ln', 'log10']) {
  register(func_name, overload('number', arg('value', 'number')));
}

register('is_inf', overload('boolean', arg('value', 'number')));

register('is_nan', overload('boolean', arg('value', 'number')));

register(
  'pow',
  overload('number', arg('base', 'number'), arg('exponent', 'number'))
);

register(
  'log',
  overload('number', arg('value', 'number'), arg('base', 'number'))
);

for (const func_name in ['greatest', 'least']) {
  register(func_name, overload('number', vararg('values', 'number')));
}

register(
  'div',
  overload('number', arg('dividend', 'number'), arg('divisor', 'number'))
);

register(
  'mod',
  overload('number', arg('value', 'number'), arg('modulus', 'number'))
);

register('concat', overload('string', vararg('values', 'string')));

register(
  'strpos',
  overload('number', arg('source', 'string'), arg('target', 'string'))
);

for (const func_name in ['lower', 'upper', 'reverse']) {
  register(func_name, overload('string', arg('value', 'string')));
}

register(
  'repeat',
  overload('string', arg('text', 'string'), arg('repetitions', 'number'))
);

register('length', overload('number', arg('value', 'string')));

register('byte_length', overload('number', arg('value', 'string')));

register(
  'starts_with',
  overload('boolean', arg('value', 'string'), arg('prefix', 'string'))
);

register(
  'ends_with',
  overload('boolean', arg('value', 'string'), arg('suffix', 'string'))
);

register(
  'substr',
  overload('string', arg('value', 'string'), arg('start_index', 'string')),
  overload(
    'string',
    arg('value', 'string'),
    arg('start_index', 'number'),
    arg('max_length', 'number')
  )
);

for (const func_name in ['trim', 'ltrim', 'rtrim']) {
  register(
    func_name,
    overload('string', arg('value', 'string')),
    overload('string', arg('value', 'string'), arg('characters', 'string'))
  );
}

register(
  'replace',
  overload(
    'string',
    arg('text', 'string'),
    // TODO maybe this arg can just be a regexp also...
    arg('pattern', 'string'),
    arg('replacement', 'string')
  )
);

// TODO maybe we just get rid of regexp_replace and make replace allow a regular expression as the pattern
register(
  'regexp_replace',
  overload(
    'string',
    arg('text', 'string'),
    arg('pattern', 'regular_expression'),
    arg('replacement', 'string')
  )
);

// TODO can we just call this extract?
register(
  'regexp_extract',
  overload(
    'string',
    arg('text', 'string'),
    arg('pattern', 'regular_expression')
  )
);

register(
  'coalesce',
  ...(
    ['string', 'number', 'date', 'timestamp', 'boolean'] as AtomicFieldType[]
  ).map(type => overload(type, vararg('values', type)))
);

register('num_nulls', overload('number', vararg('values', 'any')));
register('num_nonnulls', overload('number', vararg('values', 'any')));

// TODO can we call this "random"?
register('rand', overload('number'));

register('pi', overload('number'));

// TODO it's unclear whether we want to do these...
// probably not, since we don't have a bytes type
// though I guess we could just represent as UTF-8 or base64?
for (const func_name in ['md5', 'sha256', 'sha512']) {
  register(func_name, overload('string', arg('value', 'string')));
}

register('ascii', overload('number', arg('character', 'string')));

register('unicode', overload('number', arg('character', 'string')));

register('chr', overload('string', arg('code_point', 'number')));

register(
  'format',
  overload('string', arg('format_string', 'string'), vararg('values', 'any'))
);

register('to_hex', overload('string', arg('value', 'number')));

// TODO should the return type be string?
// Or UUID in postgres?
register('generate_uuid', overload('string'));

register(
  'error',
  // TODO the return type is really "never" or perhaps "any"
  overload('boolean'),
  overload('boolean', arg('message', 'string'))
);
