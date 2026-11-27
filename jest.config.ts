import type {Config} from 'jest';
import * as fs from 'fs';
import * as path from 'path';
import type * as DatabasesModule from './test/src/databases.ts';

// Which tests run where is set out in the Testing section of CONTEXT.md. This
// file reads `test/src/databases.ts` as data and loads no database client.

// Node loads databases.ts as an ES module in a package which doesn't declare
// itself one, and warns that it had to look. The warning is about how the
// file is loaded, never about what is in it.
const emitWarning = process.emitWarning;
process.emitWarning = (warning: string | Error, ...rest: never[]) => {
  if (!String(warning).includes('Reparsing as ES module')) {
    emitWarning(warning, ...rest);
  }
};
const {databases, databaseSets}: typeof DatabasesModule =
  await import('./test/src/databases.ts');
process.emitWarning = emitWarning;

process.env['TZ'] = 'America/Los_Angeles';

// ESM-only deps that ship plain static import/export: jest's CJS runtime can't
// load them as-is, so they must be transformed (not ignored). See the Class-1
// ESM note in docs/dependency-management/CONTEXT.md. (uuid and @noble/hashes were here until
// they were pinned to CJS-consumable majors — an ESM-only runtime dep leaks
// downstream like a native binary, so the core stays CJS.)
const transformIgnoreModules = ['@motherduck/wasm-client'].join('|');

const defaultConfig: Config = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts', 'jest-expect-message'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/out/'],
  // node_modules is left untransformed except the Class-1 ESM-only deps above,
  // which must be run through babel to become loadable under jest's CJS runtime.
  transformIgnorePatterns: [`node_modules/(?!(${transformIgnoreModules})/)`],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {tsconfig: '<rootDir>/test/tsconfig.json'}],
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        'presets': ['@babel/preset-env'],
        'plugins': [['@babel/transform-runtime']],
      },
    ],
  },
};

// Every spec file, relative to the repo root. The consumer canary runs under
// its own config (test/consumer-canary), so it is left out.
const specFiles = fs
  .globSync('{packages,test,scripts}/**/*.spec.{ts,tsx,js,jsx}', {
    cwd: import.meta.dirname,
    exclude: f =>
      f === 'node_modules' ||
      f === 'dist' ||
      f === 'out' ||
      f === 'consumer-canary',
  })
  .sort();

const RENDER_PACKAGE = 'packages/malloy-render/';
const RENDER_TESTS = 'test/src/render/';

const allNames = new Set([
  ...Object.keys(databases),
  ...Object.keys(databaseSets),
  'all',
]);

function dbPart(file: string): string | undefined {
  return path.basename(file).match(/\.db-([^.]+)\.spec\.[jt]sx?$/)?.[1];
}

// A typo in a `db-` part would leave a file that never runs.
const misnamed = specFiles.filter(f => {
  const part = dbPart(f);
  return part !== undefined && !allNames.has(part);
});
if (misnamed.length > 0) {
  throw new Error(
    `These files name a database which is not in test/src/databases.ts:\n  ${misnamed.join('\n  ')}\n` +
      `The names are: ${[...allNames].join(', ')}`
  );
}

function matchesAny(file: string, globs: string[]): boolean {
  return globs.some(g => path.matchesGlob(file, g));
}

function checkGlob(glob: string, matched: string[], what: string): void {
  if (matched.length === 0) {
    throw new Error(`${what} glob "${glob}" matches no files`);
  }
}

const connectionTestGlobs = Object.values(databases).flatMap(d =>
  d.connectionTests ? [d.connectionTests] : []
);
for (const g of connectionTestGlobs) {
  checkGlob(
    g,
    specFiles.filter(f => path.matchesGlob(f, g)),
    'connectionTests'
  );
}

const isConnectionTest = (f: string) => matchesAny(f, connectionTestGlobs);

// Core is every plain spec. It is written as patterns rather than a file
// list so that jest's "No tests found" report stays readable. A connection
// test glob contributes the directory before its first wildcard.
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const connectionDirs = [
  ...new Set(connectionTestGlobs.map(g => g.replace(/[*?[{].*$/, ''))),
];
const coreProject: Config = {
  ...defaultConfig,
  displayName: 'core',
  roots: ['<rootDir>/packages', '<rootDir>/test', '<rootDir>/scripts'],
  testMatch: ['**/*.spec.{ts,tsx,js,jsx}'],
  testPathIgnorePatterns: [
    ...(defaultConfig.testPathIgnorePatterns ?? []),
    '/test/consumer-canary/',
    '\\.db-[^.]+\\.spec\\.[jt]sx?$',
    ...[RENDER_PACKAGE, RENDER_TESTS, ...connectionDirs].map(
      d => `<rootDir>/${escapeRegex(d)}`
    ),
  ],
};

// The files a database runs. `narrowed` applies dbAllPassing and dbAllSkip,
// which only `npm run dbtest` does.
function filesFor(name: string, narrowed: boolean): string[] {
  const entry = databases[name];
  const sets = Object.entries(databaseSets)
    .filter(([, members]) => members.includes(name))
    .map(([set]) => set);
  const own = specFiles.filter(f => {
    const part = dbPart(f);
    return part === name || (part !== undefined && sets.includes(part));
  });
  const connection = entry.connectionTests
    ? specFiles.filter(f => path.matchesGlob(f, entry.connectionTests ?? ''))
    : [];
  let dbAll = specFiles.filter(f => dbPart(f) === 'all');
  if (narrowed) {
    const inTestSrc = (g: string) => `test/src/${g}`;
    if (entry.dbAllPassing !== undefined) {
      for (const g of entry.dbAllPassing) {
        checkGlob(
          g,
          dbAll.filter(f => path.matchesGlob(f, inTestSrc(g))),
          `${name} dbAllPassing`
        );
      }
      const passing = entry.dbAllPassing.map(inTestSrc);
      dbAll = dbAll.filter(f => matchesAny(f, passing));
    }
    if (entry.dbAllSkip !== undefined) {
      for (const g of entry.dbAllSkip) {
        checkGlob(
          g,
          dbAll.filter(f => path.matchesGlob(f, inTestSrc(g))),
          `${name} dbAllSkip`
        );
      }
      const skip = entry.dbAllSkip.map(inTestSrc);
      dbAll = dbAll.filter(f => !matchesAny(f, skip));
    }
  }
  return [...connection, ...own, ...dbAll];
}

const selected = process.env['MALLOY_DATABASE'] || undefined;
if (selected?.includes(',')) {
  throw new Error(
    `MALLOY_DATABASE names one database, not a list: "${selected}"`
  );
}
if (selected !== undefined && databases[selected] === undefined) {
  throw new Error(
    `MALLOY_DATABASE=${selected} is not a database. The databases are: ${Object.keys(databases).join(', ')}`
  );
}

const exactly = (files: string[]) => files.map(f => `<rootDir>/${f}`);

// A project with no files would make jest match everything under its roots.
function databaseProject(displayName: string, files: string[]): Config[] {
  if (files.length === 0) {
    return [];
  }
  return [{...defaultConfig, displayName, testMatch: exactly(files)}];
}

// With no database chosen, a database file still belongs to a project, so
// running one fails with a message saying how to choose, instead of finding
// no tests. A connection test runs as it is.
const databaseFiles =
  selected !== undefined
    ? filesFor(selected, process.env['MALLOY_DBTEST'] === '1')
    : specFiles.filter(f => dbPart(f) !== undefined || isConnectionTest(f));
const databaseProjects = databaseProject(
  selected ?? 'no-database',
  databaseFiles
);

// A file given on the command line which this run won't include gets a
// reason, instead of jest's "No tests found".
const runFiles = new Set(databaseFiles);
const notRun = process.argv
  .slice(2)
  .filter(a => /\.spec\.[jt]sx?$/.test(a))
  .map(a => path.relative(import.meta.dirname, path.resolve(a)))
  .filter(f => dbPart(f) !== undefined || isConnectionTest(f))
  .filter(f => !runFiles.has(f));
for (const f of notRun) {
  const part = dbPart(f);
  let reason: string;
  if (part === 'all') {
    reason =
      `${f} is a db-all file which \`npm run dbtest ${selected}\` leaves out ` +
      '(dbAllPassing / dbAllSkip in test/src/databases.ts). ' +
      `MALLOY_DATABASE=${selected} npx jest ${f} runs it.`;
  } else {
    const runsOn =
      part === undefined
        ? Object.entries(databases)
            .filter(
              ([, d]) =>
                d.connectionTests && path.matchesGlob(f, d.connectionTests)
            )
            .map(([n]) => n)
        : (databaseSets[part] ?? [part]);
    reason =
      `${f} runs on ${runsOn.join(' or ')}, and MALLOY_DATABASE is ${selected}. ` +
      `Set MALLOY_DATABASE=${runsOn[0]} to run it.`;
  }
  // eslint-disable-next-line no-console
  console.error(reason);
}

const config: Config = {
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  testTimeout: 100000,
  verbose: true,
  testEnvironment: 'node',
  projects: [
    coreProject,
    {
      // The render tests need a DOM (jest.setup.dom.ts). They are kept in
      // their own project so the fake `document` global is not in scope for
      // the duckdb-wasm tests — web-worker's browser detection keys
      // off `typeof document` and breaks under Node when it is present.
      ...defaultConfig,
      displayName: 'malloy-render-test',
      setupFilesAfterEnv: [
        '<rootDir>/test/jest.setup.dom.ts',
        ...(defaultConfig.setupFilesAfterEnv ?? []),
      ],
      roots: [`<rootDir>/${RENDER_TESTS}`],
    },
    {
      ...defaultConfig,
      displayName: 'malloy-render',
      rootDir: `<rootDir>/${RENDER_PACKAGE}`,
      testMatch: ['<rootDir>/src/**/*.spec.(ts|js)?(x)'],
      setupFilesAfterEnv: [],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.(ts|tsx)$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.json',
          },
        ],
        '^.+\\.(js|jsx)$': [
          'babel-jest',
          {
            'presets': ['@babel/preset-env'],
            'plugins': [['@babel/transform-runtime']],
          },
        ],
      },
    },
    ...databaseProjects,
  ],
};

export default config;
