module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy-db-sqlserver/',
    '<rootDir>/test/src/databases/sqlserver/',
    '<rootDir>/test/src/databases/all/',
    // TODO (vitor): I'm running all tests for the moment but this needs some back and forth
  ],
};
