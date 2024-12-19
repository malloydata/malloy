import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {Preview} from '@storybook/html';
import registeredData from './registered_data.json';
import theme from './theme';

let memoConnection: DuckDBWASMConnection | null = null;
async function createConnection() {
  if (memoConnection) return memoConnection;
  const connection = new DuckDBWASMConnection('duckdb', null, undefined, {
    rowLimit: 1000,
  });
  await connection.connecting;
  for (let tableName of registeredData) {
    const tableUrl = `data/${tableName}`;
    const fullTableName = `static/${tableUrl}`;
    await connection.registerRemoteTable(
      fullTableName,
      new window.URL(tableUrl, window.location.href).toString()
    );
  }
  memoConnection = connection;
  return connection;
}

const preview: Preview = {
  parameters: {
    actions: {
      // argTypesRegex: '^on[A-Z].*'
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      theme,
    },
  },
  initialGlobals: {
    // Doing this with a lazy callback in the context because otherwise
    // Storybook was providing an empty Promise on first render when trying to directly createConnection here
    getConnection: () => createConnection(),
  },
};

export default preview;
