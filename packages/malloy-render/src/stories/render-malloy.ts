import {SingleConnectionRuntime} from '@malloydata/malloy';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {HTMLView} from '../html';

type RenderOptions = {
  script: string;
  source: string;
  view: string;
  connection: Promise<DuckDBWASMConnection>;
};

async function runAndRender({script, source, view, connection}: RenderOptions) {
  const conn = await connection;
  const runtime = new SingleConnectionRuntime(conn);
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
