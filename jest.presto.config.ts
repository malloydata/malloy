module.exports = {
  ...require('./jest.config.ts'),
  roots: [
    '<rootDir>/test/src/databases/all/',
    '<rootDir>/test/src/databases/presto-trino/',
  ],
};
