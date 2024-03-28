const {JSDOM, VirtualConsole} = require('jsdom');
const {window} = new JSDOM(``, {
  virtualConsole: new VirtualConsole().sendTo(console, {omitJSDOMErrors: true}),
});
global.document = window.document;
global.HTMLElement = window.HTMLElement;
global.customElements = window.customElements;
global.CSSStyleSheet = window.CSSStyleSheet;
