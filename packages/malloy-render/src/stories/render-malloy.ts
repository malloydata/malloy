import {SingleConnectionRuntime} from '@malloydata/malloy';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {HTMLView} from '../html';

type RenderOptions = {
  script: string;
  source: string;
  view: string;
};

async function runAndRender({script, source, view}: RenderOptions) {
  const connection = new DuckDBWASMConnection('duckdb');
  const tableName = 'data/products.parquet';
  await connection.connecting;
  await connection.registerRemoteTable(
    tableName,
    new window.URL(tableName, window.location.href).toString()
  );
  const runtime = new SingleConnectionRuntime(connection);
  const model = runtime.loadModel(script);
  const runner = model.loadQuery(`run: ${source} -> ${view}`);
  const viewer = new HTMLView(document);
  const result = await runner.run();
  return await viewer.render(result, {dataStyles: {}});
}

export function renderMalloy(options: RenderOptions) {
  const div = document.createElement('div');
  runAndRender(options).then(el => div.replaceChildren(el));
  return div;
}
