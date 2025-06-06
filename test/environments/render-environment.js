// eslint-disable-next-line node/no-unpublished-require
const NodeEnvironment = require('jest-environment-node');
const {JSDOM} = require('jsdom');

class RenderTestEnvironment extends NodeEnvironment.TestEnvironment {
  constructor(...args) {
    super(...args);
  }

  async setup() {
    await super.setup();
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost/',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    });
    this.global.window = dom.window;
    this.global.document = dom.window.document;
    this.global.navigator = dom.window.navigator;
    this.global.HTMLElement = dom.window.HTMLElement;
    this.global.customElements = dom.window.customElements;
    this.global.CSSStyleSheet = dom.window.CSSStyleSheet;
    this.global.XMLHttpRequest = dom.window.XMLHttpRequest;
    this.global.DOMParser = dom.window.DOMParser;
  }

  async teardown() {
    this.global.window = undefined;
    this.global.document = undefined;
    this.global.navigator = undefined;
    this.global.HTMLElement = undefined;
    this.global.customElements = undefined;
    this.global.CSSStyleSheet = undefined;
    this.global.XMLHttpRequest = undefined;
    this.global.DOMParser = undefined;

    await super.teardown();
  }
}

module.exports = RenderTestEnvironment;
