/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {JSDOM, VirtualConsole} from 'jsdom';

const {window} = new JSDOM('', {
  url: 'http://localhost/',
  virtualConsole: new VirtualConsole().sendTo(console, {omitJSDOMErrors: true}),
});
global.document = window.document;
global.HTMLElement = window.HTMLElement;
global.customElements = window.customElements;
global.CSSStyleSheet = window.CSSStyleSheet;
