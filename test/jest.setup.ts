import {JSDOM, VirtualConsole} from 'jsdom';
import {DuckDBConnection} from '@malloydata/db-duckdb';

const {window} = new JSDOM('', {
  virtualConsole: new VirtualConsole().sendTo(console, {omitJSDOMErrors: true}),
});
global.document = window.document;
global.HTMLElement = window.HTMLElement;
global.customElements = window.customElements;
global.CSSStyleSheet = window.CSSStyleSheet;

// Clean up all DuckDB instances after each test file to release file locks
afterAll(() => {
  DuckDBConnection.closeAllInstances();
});

/**
 * A replacement for [test()] that mimics [test.skip()]
 */

const testSkip: jest.It = Object.assign(
  (name: string, fn?: jest.ProvidesCallback, timeout?: number) =>
    test.skip(name, fn, timeout),
  {
    ...test,
  }
);

test.when = (condition: boolean): jest.It => {
  if (condition) {
    return test;
  } else {
    return testSkip;
  }
};
