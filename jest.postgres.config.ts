module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy-db-postgres/',
    '<rootDir>/test/src/databases/all/',
    '<rootDir>/test/src/databases/postgres/',
  ],
};
