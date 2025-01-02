module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/test/src/databases/all/',
    '<rootDir>/packages/malloy-db-postgres/src/',
    '<rootDir>/test/src/databases/postgres/',
  ],
};
