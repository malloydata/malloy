import {LoaderFunction, Args} from '@storybook/types';
import {HtmlRenderer} from '@storybook/html';
import {SingleConnectionRuntime} from '@malloydata/malloy';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {HTMLView} from '../html';
import {RendererOptions} from '../html/renderer_types';

export type QueryOptions = {
  script: string;
  source: string;
  view: string;
  connection: Promise<DuckDBWASMConnection>;
};

export function createLoader(
  script: string
): LoaderFunction<HtmlRenderer, Args> {
  return async context => {
    return {
      result: await runQuery({
        script,
        source: context.args['source'],
        view: context.args['view'],
        connection: context.globals['getConnection'](),
      }),
    };
  };
}

export async function loadModel({
  script,
  connection,
}: {
  script: string;
  connection: Promise<DuckDBWASMConnection>;
}) {
  const conn = await connection;
  return new SingleConnectionRuntime(conn).loadModel(script);
}

export async function runQuery({
  script,
  source,
  view,
  connection,
}: QueryOptions) {
  const model = await loadModel({script, connection});
  const runner = model.loadQuery(`run: ${source} -> ${view}`);
  const result = await runner.run();
  return result;
}

/* Legacy Renderer */

type RenderOptions = QueryOptions & {
  classes?: '';
};

async function runAndRender(
  {script, source, view, connection}: RenderOptions,
  options: RendererOptions = {dataStyles: {}}
) {
  const viewer = new HTMLView(document);
  const result = await runQuery({script, source, view, connection});
  return await viewer.render(result, options);
}

export function renderMalloyLegacy(options: RenderOptions) {
  const div = document.createElement('div');
  runAndRender(options, {
    dataStyles: {},
    isDrillingEnabled: true,
    onDrill: (
      drillQuery: string,
      _target: HTMLElement,
      _drillFilters: string[]
    ) => {
      navigator.clipboard.writeText(drillQuery);
    },
  }).then(el => {
    if (options.classes) el.classList.add(options.classes);
    div.replaceChildren(el);
  });
  return div;
}
