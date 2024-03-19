const {JSDOM} = require('jsdom');
const {window} = new JSDOM(``);
global.document = window.document;
global.HTMLElement = window.HTMLElement;
global.customElements = window.customElements;
global.CSSStyleSheet = window.CSSStyleSheet;
