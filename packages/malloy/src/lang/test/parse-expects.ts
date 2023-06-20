/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {MalloyTranslator, TranslateResponse} from '..';
import {DocumentLocation} from '../../model';
import {
  BetaExpression,
  MarkedSource,
  pretty,
  TestTranslator,
} from './test-translator';
import {inspect} from 'util';
import {LogSeverity} from '../parse-log';

type SimpleProblemSpec = string | RegExp;
type ComplexProblemSpec = {severity: LogSeverity; message: SimpleProblemSpec};
type ProblemSpec = SimpleProblemSpec | ComplexProblemSpec;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      modelParsed(): R;
      toBeErrorless(): R;
      toCompile(): R;
      toCompileWithWarnings(...expectedWarnings: SimpleProblemSpec[]): R;
      modelCompiled(): R;
      expressionCompiled(): R;
      toReturnType(tp: string): R;
      compileToFailWith(...expectedErrors: ProblemSpec[]): R;
      isLocationIn(at: DocumentLocation, txt: string): R;
    }
  }
}

function checkForErrors(trans: MalloyTranslator) {
  if (trans.logger === undefined) {
    throw new Error('JESTERY BROKEN, CANT FIND ERORR LOG');
  }
  if (trans.logger.hasErrors()) {
    return {
      message: () => `Translation Errors:\n${trans.prettyErrors()}`,
      pass: false,
    };
  }
  return {
    message: () => 'Unexpected error free translation',
    pass: true,
  };
}

function prettyNeeds(response: TranslateResponse) {
  let needString = '';
  if (response.tables) {
    needString += 'Tables:\n';
    response.tables.forEach(table => (needString += `  - ${table}`));
  }
  if (response.compileSQL) {
    needString += `Compile SQL: ${response.compileSQL.name}`;
  }
  if (response.urls) {
    needString += 'URLs:\n';
    response.urls.forEach(url => (needString += `  - ${url}`));
  }
  return needString;
}

function checkForNeededs(trans: TestTranslator) {
  const response = trans.translateStep.step(trans);
  if (!response.final) {
    return {
      message: () =>
        `Translation is not complete, needs:\n${prettyNeeds(response)}`,
      pass: false,
    };
  }
  return {
    message: () => 'Unexpected complete translation',
    pass: true,
  };
}

function highlightError(dl: DocumentLocation, txt: string): string {
  if (dl === undefined) {
    return '~Location Undefined~';
  }
  const {start, end} = dl.range;
  const output = [
    `${start.line}:${start.character}-${end.line}:${end.character}`,
  ];
  let errStart = start.character;
  const doc = txt.split('\n');
  for (let line = start.line; line <= end.line; line += 1) {
    const lineText = doc[line];
    const lineStr = `     ${line}`.slice(-5);
    output.push(`${lineStr}| ${lineText}`);
    const upToError = '     | ' + ' '.repeat(errStart);
    let errLen = end.character - errStart;
    if (line < end.line) {
      errLen = lineText.length - errStart;
      errStart = 0;
    }
    output.push(upToError + '-'.repeat(errLen));
  }
  return output.join('\n');
}

function normalizeProblemSpec(
  defaultSeverity: LogSeverity
): (spec: ProblemSpec) => ComplexProblemSpec {
  return function (spec: ProblemSpec) {
    if (typeof spec === 'string') {
      return {severity: defaultSeverity, message: spec};
    } else if (spec instanceof RegExp) {
      return {severity: defaultSeverity, message: spec};
    } else {
      return spec;
    }
  };
}

expect.extend({
  toCompile: function (s: string) {
    const x = new TestTranslator(s);
    x.compile();
    const errorCheck = checkForErrors(x);
    if (!errorCheck.pass) {
      return errorCheck;
    }
    x.translate();
    return checkForNeededs(x);
  },
  modelParsed: function (x: TestTranslator) {
    x.compile();
    return checkForErrors(x);
  },
  modelCompiled: function (x: TestTranslator) {
    x.compile();
    const errorCheck = checkForErrors(x);
    if (!errorCheck.pass) {
      return errorCheck;
    }
    x.translate();
    return checkForNeededs(x);
  },
  expressionCompiled: function (src: string) {
    const x = new BetaExpression(src);
    x.compile();
    const errorCheck = checkForErrors(x);
    if (!errorCheck.pass) {
      return errorCheck;
    }
    return checkForNeededs(x);
  },
  toBeErrorless: function (trans: MalloyTranslator) {
    return checkForErrors(trans);
  },
  toReturnType: function (functionCall: string, returnType: string) {
    const exprModel = new TestTranslator(
      `source: x is a { dimension: d is ${functionCall} }`
    );
    expect(exprModel).modelCompiled();
    const x = exprModel.getSourceDef('x');
    expect(x).toBeDefined();
    if (x) {
      const d = x.fields.find(f => f.name === 'd');
      expect(d?.type).toBe(returnType);
    }
    return {
      pass: true,
      message: () => '',
    };
  },
  compileToFailWith: function (
    s: MarkedSource | string | TestTranslator,
    ...msgs: ProblemSpec[]
  ) {
    return checkForProblems(this, false, s, 'error', ...msgs);
  },
  toCompileWithWarnings: function (
    s: MarkedSource | string | TestTranslator,
    ...msgs: SimpleProblemSpec[]
  ) {
    return checkForProblems(this, true, s, 'warn', ...msgs);
  },
  isLocationIn: function (
    checkAt: DocumentLocation,
    at: DocumentLocation,
    text: string
  ) {
    if (this.equals(at, checkAt)) {
      return {
        pass: true,
        message: () => 'Locations match',
      };
    }
    const errMsg =
      'Locations do not match\n' +
      `Expected: ${highlightError(at, text)}\n` +
      `Received: ${highlightError(checkAt, text)}\n`;
    return {
      pass: false,
      message: () => errMsg,
    };
  },
});

function checkForProblems(
  context: jest.MatcherContext,
  expectCompiles: boolean,
  s: MarkedSource | string | TestTranslator,
  defaultSeverity: LogSeverity,
  ...msgs: ProblemSpec[]
) {
  let emsg = `Expected ${expectCompiles ? 'to' : 'to not'} compile with: `;
  let mSrc: MarkedSource | undefined;
  const normalize = normalizeProblemSpec(defaultSeverity);
  const normMsgs = msgs.map(normalize);
  const qmsgs = normMsgs.map(s => `${s.severity} '${s.message}'`);
  if (msgs.length === 1) {
    emsg += ` ${qmsgs[0]}`;
  } else {
    emsg += `s [\n${qmsgs.join('\n')}\n]`;
  }
  let m: TestTranslator;
  let src: string;
  if (s instanceof TestTranslator) {
    m = s;
    src = m.testSrc;
  } else {
    if (typeof s === 'string') {
      src = s;
    } else {
      src = s.code;
      mSrc = s;
    }
    m = new TestTranslator(src);
  }
  emsg += `\nSource:\n${src}`;
  m.compile();
  const t = m.translate();
  if (t.translated && !expectCompiles) {
    return {pass: false, message: () => emsg};
  } else if (!t.translated && expectCompiles) {
    return {pass: false, message: () => emsg};
  } else if (t.problems === undefined) {
    return {
      pass: false,
      message: () =>
        'TEST ERROR, not all objects resolved in source\n' +
        pretty(t) +
        '\n' +
        emsg,
    };
  } else {
    const explain: string[] = [];
    const errList = m.problemResponse().problems;
    let i;
    for (i = 0; i < normMsgs.length && errList[i]; i += 1) {
      const msg = normMsgs[i];
      const err = errList[i];
      const matched =
        typeof msg.message === 'string'
          ? msg.message === err.message
          : err.message.match(msg.message);
      if (err.severity !== msg.severity) {
        explain.push(
          `Expected ${msg.severity}, got ${err.severity} ${err.message}`
        );
      }
      if (!matched) {
        explain.push(`Expected: ${msg.message}\nGot: ${err.message}`);
      } else {
        if (mSrc?.locations[i]) {
          const have = err.at?.range;
          const want = mSrc.locations[i].range;
          if (!context.equals(have, want)) {
            explain.push(
              `Expected '${msg.message}' at location: ${inspect(want)}\n` +
                `Actual location: ${inspect(have)}`
            );
          }
        }
      }
    }
    if (i !== msgs.length) {
      explain.push(...msgs.slice(i).map(m => `Missing: ${m}`));
    }
    if (i !== errList.length) {
      explain.push(
        ...errList.slice(i).map(m => `Unexpected Error: ${m.message}`)
      );
    }
    if (explain.length === 0) {
      return {
        pass: true,
        message: () => `All expected errors found: ${pretty(msgs)}`,
      };
    }
    return {
      pass: false,
      message: () =>
        `Compiler did not generated expected errors\n${explain.join('\n')}`,
    };
  }
}
