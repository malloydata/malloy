import {JSDOM, VirtualConsole} from 'jsdom';
const {window} = new JSDOM('', {
  virtualConsole: new VirtualConsole().sendTo(console, {omitJSDOMErrors: true}),
});
global.document = window.document;
global.HTMLElement = window.HTMLElement;
global.customElements = window.customElements;
global.CSSStyleSheet = window.CSSStyleSheet;

/**
 * A replacement for [describe()] that mimics [describe.skip()]
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
