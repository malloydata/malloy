import {DuckDBConnection} from '@malloydata/db-duckdb';

// Clean up all DuckDB instances after each test file to release file locks
afterAll(() => {
  DuckDBConnection.closeAllInstances();
});

/**
 * A replacement for [test()] that mimics [test.skip()]
 */

const testSkip: jest.It = Object.assign(
  (name: string, fn?: jest.ProvidesCallback, timeout?: number) =>
    test.skip(name, fn, timeout),
  {
    ...test,
  }
);

test.when = (condition: boolean): jest.It => {
  if (condition) {
    return test;
  } else {
    return testSkip;
  }
};
