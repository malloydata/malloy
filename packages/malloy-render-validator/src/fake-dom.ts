/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Minimal DOM stub for headless environments (Node.js).
 * Provides just enough surface for the renderer's UMD bundle to load
 * without crashing. Not suitable for actual rendering.
 *
 * Importing this module auto-installs globals if they are absent.
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

/**
 * Install minimal DOM globals if not already present.
 * Called automatically on import; safe to call again.
 */
export function ensureFakeDom(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;

  if (typeof g.document === 'undefined') {
    g.document = new Document();
  }

  if (typeof g.navigator === 'undefined') {
    g.navigator = {userAgent: ''};
  } else if (typeof g.navigator.userAgent === 'undefined') {
    g.navigator.userAgent = '';
  }

  if (typeof g.window === 'undefined') {
    g.window = Object.assign(g, {
      addEventListener: noop,
      removeEventListener: noop,
      getComputedStyle: () => ({}),
      requestAnimationFrame: noop,
      cancelAnimationFrame: noop,
    });
  }
}

// Auto-install on import
ensureFakeDom();
