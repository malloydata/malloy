import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {Preview} from '@storybook/html';
import registeredData from './registered_data.json';

async function createConnection() {
  const connection = new DuckDBWASMConnection('duckdb', null, undefined, {
    rowLimit: 1000,
  });
  await connection.connecting;
  for (let tableName of registeredData) {
    const fullTableName = `data/${tableName}`;
    await connection.registerRemoteTable(
      fullTableName,
      new window.URL(fullTableName, window.location.href).toString()
    );
  }
  return connection;
}

const preview: Preview = {
  parameters: {
    actions: {argTypesRegex: '^on[A-Z].*'},
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globals: {
    connection: createConnection(),
  },
};

export default preview;
