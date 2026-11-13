/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Installs the web-platform globals the compiler reads, for engines that
 * only supply the ECMAScript built-ins (QuickJS, for example). Each one is
 * installed only when the host has not already provided it, so a host with a
 * better implementation (a real random source, a monotonic clock) should
 * define it before evaluating the bundle.
 *
 * This module must be imported before anything else in the bundle: the
 * `whatwg-url` polyfill builds a `TextEncoder` when it loads.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

// `uuid` draws on this to name internal query and source objects. Those
// names only need to be unique within one compile, not unpredictable, so a
// Math.random fallback is acceptable.
if (typeof g.crypto?.getRandomValues !== 'function') {
  const getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array) {
      const bytes = new Uint8Array(
        array.buffer,
        array.byteOffset,
        array.byteLength
      );
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  };
  g.crypto = {...(g.crypto ?? {}), getRandomValues};
}

// The compiler's timing information.
if (typeof g.performance?.now !== 'function') {
  g.performance = {...(g.performance ?? {}), now: () => Date.now()};
}

// UTF-8 only, which is all `whatwg-url` asks of these.
if (typeof g.TextEncoder === 'undefined') {
  g.TextEncoder = class TextEncoder {
    readonly encoding = 'utf-8';
    encode(input = ''): Uint8Array {
      const bytes: number[] = [];
      for (const ch of input) {
        let c = ch.codePointAt(0) ?? 0;
        if (c >= 0xd800 && c <= 0xdfff) {
          c = 0xfffd; // a lone surrogate
        }
        if (c < 0x80) {
          bytes.push(c);
        } else if (c < 0x800) {
          bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        } else if (c < 0x10000) {
          bytes.push(
            0xe0 | (c >> 12),
            0x80 | ((c >> 6) & 0x3f),
            0x80 | (c & 0x3f)
          );
        } else {
          bytes.push(
            0xf0 | (c >> 18),
            0x80 | ((c >> 12) & 0x3f),
            0x80 | ((c >> 6) & 0x3f),
            0x80 | (c & 0x3f)
          );
        }
      }
      return new Uint8Array(bytes);
    }
  };
}

if (typeof g.TextDecoder === 'undefined') {
  g.TextDecoder = class TextDecoder {
    readonly encoding = 'utf-8';
    decode(input?: ArrayBufferView | ArrayBuffer): string {
      if (input === undefined) {
        return '';
      }
      const bytes = ArrayBuffer.isView(input)
        ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
        : new Uint8Array(input);
      let out = '';
      let i = 0;
      while (i < bytes.length) {
        const b = bytes[i];
        let need = 0;
        let c = 0xfffd;
        if (b < 0x80) {
          c = b;
        } else if (b >= 0xc2 && b < 0xe0) {
          need = 1;
          c = b & 0x1f;
        } else if (b >= 0xe0 && b < 0xf0) {
          need = 2;
          c = b & 0x0f;
        } else if (b >= 0xf0 && b < 0xf5) {
          need = 3;
          c = b & 0x07;
        }
        i++;
        let ok = true;
        for (let k = 0; k < need; k++) {
          const cont = bytes[i];
          if (cont === undefined || (cont & 0xc0) !== 0x80) {
            ok = false;
            break;
          }
          c = (c << 6) | (cont & 0x3f);
          i++;
        }
        // Reject overlong forms, surrogates and code points past U+10FFFF,
        // which String.fromCodePoint would throw on.
        const min = [0, 0x80, 0x800, 0x10000][need];
        const valid =
          ok && c >= min && c <= 0x10ffff && !(c >= 0xd800 && c <= 0xdfff);
        out += String.fromCodePoint(valid ? c : 0xfffd);
      }
      return out;
    }
  };
}
