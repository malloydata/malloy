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
import {
  DocumentLocation,
  DocumentRange,
  Expr,
  exprHasE,
  exprHasKids,
  exprIsLeaf,
} from '../../model';
import {
  BetaExpression,
  MarkedSource,
  pretty,
  TestTranslator,
} from './test-translator';
import {LogSeverity} from '../parse-log';

type MessageProblemSpec = {
  severity: LogSeverity;
  message: string | RegExp;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodeProblemSpec = {severity: LogSeverity; code: string; data?: any};
type ProblemSpec = CodeProblemSpec | MessageProblemSpec;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * expect(X).toParse()
       *
       * Passes if the source parses to an AST without errors.
       *
       * X can be a MarkedSource, a string, or a model.
       */
      toParse(): R;
      /**
       * expect(X).toTranslate()
       *
       * Passes if the source compiles to code which could be used to
       * generate SQL.
       *
       * X can be a MarkedSource, a string, or a model.
       */
      toTranslate(): R;
      toReturnType(tp: string): R;
      toLog(...expectedErrors: ProblemSpec[]): R;
      isLocationIn(at: DocumentLocation, txt: string): R;
      /**
       * expect(X).compilesTo('expression-string')
       *
       * X should be a string or an expr`string` or a BetaExpression
       *
       * The string is compiled, and the compiled string is then "translated" into an expression,
       * which can be used to check that the compiler did the right thing.
       *
       * Warnings are ignored, so need to be checked seperately
       */
      compilesTo(exprString: string): R;
      hasCubeUsage(cubeUsage: string[][]): R;
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

function ensureNoProblems(trans: MalloyTranslator, warningsOkay = false) {
  if (trans.logger === undefined) {
    throw new Error('JESTERY BROKEN, CANT FIND ERORR LOG');
  }
  if (warningsOkay ? trans.logger.hasErrors() : !trans.logger.empty()) {
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

function xlated(tt: TestTranslator, warningsOkay = false) {
  const errorCheck = ensureNoProblems(tt, warningsOkay);
  if (!errorCheck.pass) {
    return errorCheck;
  }
  tt.translate();
  return checkForNeededs(tt);
}

/**
 * Returns a readable shorthand for the node. Not complete, will be expanded
 * as more expressions are tested. One weird thing it does is compress field
 * references if passed an empty hash. The first field in an expression will be
 * A in the output, the second B, and so on.
 */
type ESymbols = Record<string, string> | undefined;
function eToStr(e: Expr, symbols: ESymbols): string {
  function subExpr(e: Expr): string {
    return eToStr(e, symbols);
  }
  switch (e.node) {
    case 'field': {
      const ref = e.path.join('.');
      if (symbols) {
        if (symbols[ref] === undefined) {
          const nSyms = Object.keys(symbols).length;
          symbols[ref] = String.fromCharCode('A'.charCodeAt(0) + nSyms);
        }
        return symbols[ref];
      } else {
        return ref;
      }
    }
    case '()':
      return `(${subExpr(e.e)})`;
    case 'numberLiteral':
      return `${e.literal}`;
    case 'stringLiteral':
      return `"${e.literal}"`;
    case 'timeLiteral':
      return `@${e.literal}`;
    case 'regexpLiteral':
      return `/${e.literal}/`;
    case 'trunc':
      return `{timeTrunc-${e.units} ${subExpr(e.e)}}`;
    case 'delta':
      return `{${e.op}${e.units} ${subExpr(e.kids.base)} ${subExpr(
        e.kids.delta
      )}}`;
    case 'true':
    case 'false':
      return e.node;
    case 'case': {
      const caseStmt = ['case'];
      if (e.kids.caseValue !== undefined) {
        caseStmt.push(`${subExpr(e.kids.caseValue)}`);
      }
      for (let i = 0; i < e.kids.caseWhen.length; i += 1) {
        caseStmt.push(
          `when ${subExpr(e.kids.caseWhen[i])} then ${subExpr(
            e.kids.caseThen[i]
          )}`
        );
      }
      if (e.kids.caseElse !== undefined) {
        caseStmt.push(`else ${subExpr(e.kids.caseElse)}`);
      }
      return `{${caseStmt.join(' ')}}`;
    }
    case 'regexpMatch':
      return `{${subExpr(e.kids.expr)} regex-match ${subExpr(e.kids.regex)}}`;
    case 'in': {
      return `{${subExpr(e.kids.e)} ${e.not ? 'not in' : 'in'} {${e.kids.oneOf
        .map(o => `${subExpr(o)}`)
        .join(',')}}}`;
    }
  }
  if (exprHasKids(e) && e.kids['left'] && e.kids['right']) {
    return `{${subExpr(e.kids['left'])} ${e.node} ${subExpr(e.kids['right'])}}`;
  } else if (exprHasE(e)) {
    return `{${e.node} ${subExpr(e.e)}}`;
  } else if (exprIsLeaf(e)) {
    return `{${e.node}}`;
  }
  return `{?${e.node}}`;
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
    const ok = xlated(exprModel, true);
    if (!ok.pass) {
      return ok;
    }
    const d = exprModel.generated();
    const pass = d.type === returnType;
    const msg = `Expression type ${d.type} ${pass ? '=' : '!='} ${returnType}`;
    return {pass, message: () => msg};
  },
  toLog: function (s: TestSource, ...msgs: ProblemSpec[]) {
    const expectCompiles = !msgs.some(m => m.severity === 'error');
    return checkForProblems(this, expectCompiles, s, ...msgs);
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
  compilesTo: function (tx: TestSource, expr: string) {
    let bx: BetaExpression;
    if (typeof tx === 'string') {
      bx = new BetaExpression(tx);
    } else {
      const x = xlator(tx);
      if (x instanceof BetaExpression) {
        bx = x;
      } else {
        return {
          pass: false,
          message: () =>
            'Must pass expr`EXPRESSION` to expect(EXPRSSION).compilesTo()',
        };
      }
    }
    bx.compile();
    // Only report errors, callers will need to test for warnings
    if (bx.logger.hasErrors()) {
      return {
        message: () => `Translation problems:\n${bx.prettyErrors()}`,
        pass: false,
      };
    }
    const badRefs = checkForNeededs(bx);
    if (!badRefs.pass) {
      return badRefs;
    }
    const rcvExpr = eToStr(bx.generated().value, undefined);
    const pass = this.equals(rcvExpr, expr);
    const msg = pass ? `Matched: ${rcvExpr}` : this.utils.diff(expr, rcvExpr);
    return {pass, message: () => `${msg}`};
  },
  hasCubeUsage: function (tx: TestSource, cubeUsage: string[][]) {
    let bx: BetaExpression;
    if (typeof tx === 'string') {
      bx = new BetaExpression(tx);
    } else {
      const x = xlator(tx);
      if (x instanceof BetaExpression) {
        bx = x;
      } else {
        return {
          pass: false,
          message: () =>
            'Must pass expr`EXPRESSION` to expect(EXPRSSION).compilesTo()',
        };
      }
    }
    bx.compile();
    // Only report errors, callers will need to test for warnings
    if (bx.logger.hasErrors()) {
      return {
        message: () => `Translation problems:\n${bx.prettyErrors()}`,
        pass: false,
      };
    }
    const badRefs = checkForNeededs(bx);
    if (!badRefs.pass) {
      return badRefs;
    }
    const actual = bx.generated().cubeUsage;
    const pass = this.equals(actual, cubeUsage);
    const msg = pass
      ? `Matched: ${actual}`
      : this.utils.diff(cubeUsage, actual);
    return {pass, message: () => `${msg}`};
  },
});

function problemSpecSummary(s: ProblemSpec): string {
  return `${s.severity} '${'message' in s ? s.message : s.code}' ${
    s.data !== undefined ? pretty(s.data) : ''
  }`;
}

function checkForProblems(
  context: jest.MatcherContext,
  expectCompiles: boolean,
  s: TestSource,
  ...msgs: ProblemSpec[]
) {
  let emsg = `Expected ${expectCompiles ? 'to' : 'to not'} compile with: `;
  const mSrc = isMarkedSource(s) ? s : undefined;
  const qmsgs = msgs.map(problemSpecSummary);
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
    for (i = 0; i < msgs.length && errList[i]; i += 1) {
      const msg = msgs[i];
      const err = errList[i];
      let matched = true;
      if ('message' in msg) {
        if (typeof msg.message === 'string') {
          if (msg.message !== err.message) {
            explain.push(`Expected: ${msg.message}\nGot: ${err.message}`);
            matched = false;
          }
        } else {
          if (!err.message.match(msg.message)) {
            explain.push(`Expected: ${msg.message}\nGot: ${err.message}`);
            matched = false;
          }
        }
      } else {
        if (msg.code !== err.code) {
          matched = false;
          explain.push(`Expected: ${msg.code}\nGot: ${err.code}`);
        }
      }
      if (err.severity !== msg.severity) {
        explain.push(
          `Expected ${msg.severity}, got ${err.severity} ${err.message}`
        );
      }
      if (matched) {
        if (mSrc?.locations[i]) {
          const have = err.at?.range;
          const want = mSrc.locations[i].range;
          if (!context.equals(have, want)) {
            explain.push(
              `Expected ${err.code} (${err.message}) at location: ${rangeToStr(
                want
              )}\n` + `Actual location: ${rangeToStr(have)}`
            );
          }
        }
        if (msg.data !== undefined) {
          if (JSON.stringify(msg.data) !== JSON.stringify(err.data)) {
            explain.push(
              `Expected log data ${pretty(msg.data)}\nGot ${pretty(err.data)}`
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
