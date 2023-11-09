import {SingleConnectionRuntime} from '@malloydata/malloy';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {HTMLView} from '../html';
import {RendererOptions} from '../renderer_types';

type RenderOptions = {
  script: string;
  source: string;
  view: string;
  connection: Promise<DuckDBWASMConnection>;
  classes?: '';
};

async function runAndRender(
  {script, source, view, connection}: RenderOptions,
  options: RendererOptions = {dataStyles: {}}
) {
  const conn = await connection;
  const runtime = new SingleConnectionRuntime(conn);
  const model = runtime.loadModel(script);
  const runner = model.loadQuery(`run: ${source} -> ${view}`);
  const viewer = new HTMLView(document);
  const result = await runner.run();
  return await viewer.render(result, options);
}

export function renderMalloy(options: RenderOptions) {
  const div = document.createElement('div');
  runAndRender(options, {
    dataStyles: {},
    target: div,
  }).then(el => {
    if (options.classes) el.classList.add(options.classes);
    // Needed to support legacy renderer
    div.replaceChildren(el);
  });
  return div;
}
