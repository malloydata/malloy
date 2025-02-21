module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy/',
    '<rootDir>/packages/malloy-filter/',
    '<rootDir>/packages/malloy-malloy-sql/',
    '<rootDir>/packages/malloy-syntax-highlight/',
    '<rootDir>/test/src/core/',
    '<rootDir>/test/src/render/',
  ],
};
