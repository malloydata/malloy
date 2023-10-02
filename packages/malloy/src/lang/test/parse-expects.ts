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
import {DocumentLocation, DocumentRange} from '../../model';
import {
  BetaExpression,
  MarkedSource,
  pretty,
  TestTranslator,
} from './test-translator';
import {LogSeverity} from '../parse-log';

type SimpleProblemSpec = string | RegExp;
type ComplexProblemSpec = {severity: LogSeverity; message: SimpleProblemSpec};
type ProblemSpec = SimpleProblemSpec | ComplexProblemSpec;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * expect(X).toParse()
       *
       * Passes if the source parses to an AST without errors.
       *
       * X can be a MarkedSource, a string, or a model. If it is a marked
       * source, the errors which are found must match the locations of
       * the markings.
       */
      toParse(): R;
      /**
       * expect(X).toTranslate()
       *
       * Passes if the source compiles to code which could be used to
       * generate SQL.
       *
       * X can be a MarkedSource, a string, or a model. If it is a marked
       * source, the errors which are found must match the locations of
       * the markings.
       */
      toTranslate(): R;
      /**
       * expect(X).toTranslateWithWarnings(expectedWarnings)
       *
       * Passes if the source compiles to code which could be used to
       * generate SQL, and the specified warnings appear. If X is a marked
       * source, the warnings which are found must match the locations of
       * the markings.
       *
       * X can be a MarkedSource, a string, or a model. If it is a marked
       * source, the errors which are found must match the locations of
       * the markings.
       */
      toTranslateWithWarnings(...expectedWarnings: SimpleProblemSpec[]): R;
      toReturnType(tp: string): R;
      /**
       * expect(X).translateToFailWith(expectedErrors)
       *
       * X can be a MarkedSource, a string, or a model. If it is a marked
       * source, the errors which are found must match the locations of
       * the markings.
       *
       * @param expectedErrors varargs list of strings which must match
       *        exactly, or regular expressions.
       */
      translationToFailWith(...expectedErrors: ProblemSpec[]): R;
      isLocationIn(at: DocumentLocation, txt: string): R;
    }
  }
}

function rangeToStr(loc?: DocumentRange): string {
  if (loc) {
    const from = `#${loc.start.line}:${loc.start.character}`;
    const to = `#${loc.end.line}:${loc.end.character}`;
    return `${from}-${to}`;
  }
  return 'undefined';
}

function ensureNoProblems(trans: MalloyTranslator) {
  if (trans.logger === undefined) {
    throw new Error('JESTERY BROKEN, CANT FIND ERORR LOG');
  }
  if (!trans.logger.empty()) {
    return {
      message: () => `Translation problems:\n${trans.prettyErrors()}`,
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
    for (const table in response.tables) {
      needString += `  - ${table}`;
    }
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

type TestSource = string | MarkedSource | TestTranslator;

function isMarkedSource(ts: TestSource): ts is MarkedSource {
  return typeof ts !== 'string' && !(ts instanceof TestTranslator);
}

function xlator(ts: TestSource) {
  if (ts instanceof TestTranslator) {
    return ts;
  }
  if (typeof ts === 'string') {
    return new TestTranslator(ts);
  }
  return ts.translator || new TestTranslator(ts.code);
}

function xlated(tt: TestTranslator) {
  const errorCheck = ensureNoProblems(tt);
  if (!errorCheck.pass) {
    return errorCheck;
  }
  tt.translate();
  return checkForNeededs(tt);
}

expect.extend({
  toParse: function (tx: TestSource) {
    const x = xlator(tx);
    x.compile();
    return ensureNoProblems(x);
  },
  toTranslate: function (tx: TestSource) {
    const x = xlator(tx);
    x.compile();
    return xlated(x);
  },
  toReturnType: function (exprText: string, returnType: string) {
    const exprModel = new BetaExpression(exprText);
    exprModel.compile();
    const ok = xlated(exprModel);
    if (!ok.pass) {
      return ok;
    }
    const d = exprModel.generated();
    const pass = d.dataType === returnType;
    const msg = `Expression type ${d.dataType} ${
      pass ? '=' : '!='
    } $[returnType`;
    return {pass, message: () => msg};
  },
  translationToFailWith: function (s: TestSource, ...msgs: ProblemSpec[]) {
    return checkForProblems(this, false, s, 'error', ...msgs);
  },
  toTranslateWithWarnings: function (
    s: TestSource,
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
  s: TestSource,
  defaultSeverity: LogSeverity,
  ...msgs: ProblemSpec[]
) {
  let emsg = `Expected ${expectCompiles ? 'to' : 'to not'} compile with: `;
  const mSrc = isMarkedSource(s) ? s : undefined;
  const normalize = normalizeProblemSpec(defaultSeverity);
  const normMsgs = msgs.map(normalize);
  const qmsgs = normMsgs.map(s => `${s.severity} '${s.message}'`);
  if (msgs.length === 1) {
    emsg += ` ${qmsgs[0]}`;
  } else {
    emsg += `s [\n${qmsgs.join('\n')}\n]`;
  }
  const m = xlator(s);
  const src = m.testSrc;
  emsg += `\nSource:\n${src}`;
  m.compile();
  const t = m.translate();
  if (t.translated && !expectCompiles) {
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
              `Expected '${msg.message}' at location: ${rangeToStr(want)}\n` +
                `Actual location: ${rangeToStr(have)}`
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
        `Compiler errors did not match expected errors\n${explain.join('\n')}
        -------- FROM SOURCE --------
        ${src}
        -----------------------------
        `,
    };
  }
}
