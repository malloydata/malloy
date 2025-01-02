module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy-db-bigquery/src/',
    '<rootDir>/test/src/databases/all/',
    '<rootDir>/test/src/databases/bigquery/',
  ],
};
