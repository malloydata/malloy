module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy-db-snowflake/src/',
    '<rootDir>/test/src/databases/all/',
  ],
};
