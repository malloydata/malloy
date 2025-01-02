module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/test/src/databases/all/',
    '<rootDir>/packages/malloy-db-duckdb/src/',
    '<rootDir>/test/src/databases/duckdb/',
    '<rootDir>/test/src/databases/duckdb-all/',
  ],
};
