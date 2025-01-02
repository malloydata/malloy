module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy-db-duckdb/',
    '<rootDir>/test/src/databases/all/',
    '<rootDir>/test/src/databases/duckdb-all/',
  ],
};
