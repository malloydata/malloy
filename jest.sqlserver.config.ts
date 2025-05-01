module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/packages/malloy-db-sqlserver/',
    '<rootDir>/test/src/databases/all/',
    '<rootDir>/test/src/databases/sqlserver/',
  ],
  testNamePattern: "always inner join has side effects"
};
