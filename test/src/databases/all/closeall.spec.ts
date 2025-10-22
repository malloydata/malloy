import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

describe.each(runtimes.runtimeList)(
  'connection close test %s',
  (conName, runtime) => {
    const n = runtime.dialect.sqlMaybeQuoteIdentifier('n');
    test.each(Array.from({length: 50}, (_, i) => i + 1))(
      'run SELECT %i',
      async queryNum => {
        await expect(`
          run: ${conName}.sql("""SELECT ${queryNum} as ${n} """)
        `).malloyResultMatches(runtime, {n: queryNum});
      }
    );
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
