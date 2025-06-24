module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy/',
    '<rootDir>/packages/malloy-filter/',
    '<rootDir>/packages/malloy-interfaces/',
    '<rootDir>/packages/malloy-malloy-sql/',
    // TODO remove this when we've resolved path resolution
    // '<rootDir>/packages/malloy-render/',
    '<rootDir>/packages/malloy-syntax-highlight/',
    '<rootDir>/packages/malloy-tag/',
    '<rootDir>/packages/malloy/',
    '<rootDir>/packages/malloy-query-builder/',
    '<rootDir>/test/src/core/',
    '<rootDir>/test/src/render/',
  ],
};
