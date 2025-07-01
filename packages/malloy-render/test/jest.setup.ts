import {TextEncoder, TextDecoder} from 'util';

Object.assign(global, {TextDecoder, TextEncoder});

// Polyfill for structuredClone in jsdom environment
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj: unknown) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Mock canvas for vega
HTMLCanvasElement.prototype.getContext = jest.fn();
