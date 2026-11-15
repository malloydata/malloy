/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {URL, URLSearchParams} from 'whatwg-url';

// The translator resolves every import against the importing file's URL with
// `new URL(...)`, which is a web-platform global, not part of ECMAScript.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (typeof g.URL === 'undefined') {
  g.URL = URL;
  g.URLSearchParams = URLSearchParams;
}
