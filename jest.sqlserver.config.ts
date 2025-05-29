module.exports = {
  ...require('./jest.config.ts'),
  testTimeout: 120000, // Some tests are very slow because of the limitations of sqlserver
  roots: [
    '<rootDir>/packages/malloy-db-sqlserver/',
    '<rootDir>/test/src/databases/sqlserver/',
    '<rootDir>/test/src/databases/all/',
    // TODO (vitor): I'm running all tests for the moment but this needs some back and forth
  ],
};
