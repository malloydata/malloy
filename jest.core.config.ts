module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy-malloy-sql/',
    '<rootDir>/packages/malloy-syntax-highlight/',
    '<rootDir>/packages/malloy/',
    '<rootDir>/test/src/core/',
  ],
};
