/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Minimal DOM stub for headless environments (Node.js).
 * Provides just enough surface for the renderer's UMD bundle to load
 * without crashing. Not suitable for actual rendering.
 *
 * Use `installFakeDom()` before loading the renderer, then
 * `removeFakeDom()` afterwards so other libraries (e.g. axios)
 * don't mistakenly believe they are running in a browser.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

class Node {
  childNodes: Node[] = [];
  parentNode: Node | null = null;

  appendChild(child: Node): Node {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: Node): Node {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) this.childNodes.splice(idx, 1);
    child.parentNode = null;
    return child;
  }

  get firstChild(): Node | null {
    return this.childNodes[0] ?? null;
  }

  // Event stubs — Solid.js delegates events on document
  addEventListener = noop;
  removeEventListener = noop;
}

class Text extends Node {
  constructor(public textContent: string) {
    super();
  }
}

class Element extends Node {
  tagName: string;
  private attrs: Record<string, string> = {};
  style: Record<string, string> = {};

  constructor(tagName: string) {
    super();
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  removeAttribute(name: string) {
    delete this.attrs[name];
  }
}

class Document extends Node {
  head = new Element('HEAD');
  body = new Element('BODY');
  documentElement = new Element('HTML');

  createElement(tag: string): Element {
    return new Element(tag);
  }

  createElementNS(_ns: string, tag: string): Element {
    return new Element(tag);
  }

  createTextNode(text: string): Text {
    return new Text(text);
  }
}

// Track which globals we installed so we only remove ours.
let installed = false;
let hadDocument = false;
let hadNavigator = false;
let hadWindow = false;

/**
 * Install minimal DOM globals. Call before loading the renderer UMD.
 */
export function installFakeDom(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;

  hadDocument = typeof g.document !== 'undefined';
  hadNavigator = typeof g.navigator !== 'undefined';
  hadWindow = typeof g.window !== 'undefined';

  if (!hadDocument) {
    g.document = new Document();
  }

  if (!hadNavigator) {
    g.navigator = {userAgent: ''};
  } else if (typeof g.navigator.userAgent === 'undefined') {
    g.navigator.userAgent = '';
  }

  if (!hadWindow) {
    g.window = Object.assign(g, {
      addEventListener: noop,
      removeEventListener: noop,
      getComputedStyle: () => ({}),
      requestAnimationFrame: noop,
      cancelAnimationFrame: noop,
    });
  }

  installed = true;
}

/**
 * Remove the DOM globals we installed, so libraries loaded later
 * (e.g. axios via trino-client) don't think they're in a browser.
 */
export function removeFakeDom(): void {
  if (!installed) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;

  if (!hadWindow) {
    delete g.window;
    // Clean up the properties we merged onto globalThis
    delete g.addEventListener;
    delete g.removeEventListener;
    delete g.getComputedStyle;
    delete g.requestAnimationFrame;
    delete g.cancelAnimationFrame;
  }

  if (!hadDocument) {
    delete g.document;
  }

  if (!hadNavigator) {
    delete g.navigator;
  }

  installed = false;
}
