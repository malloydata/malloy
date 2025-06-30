// Polyfill for structuredClone in jsdom environment
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Mock canvas for vega
HTMLCanvasElement.prototype.getContext = jest.fn();