module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy-db-snowflake/',
    '<rootDir>/test/src/databases/all/',
  ],
};
