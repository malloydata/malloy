import type {LoaderFunction, Args} from '@storybook/types';
import type {HtmlRenderer} from '@storybook/html';
import type {URLReader} from '@malloydata/malloy';
import {API, SingleConnectionRuntime} from '@malloydata/malloy';
import type {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {HTMLView} from '../html';
import type {RendererOptions} from '../html/renderer_types';
import type * as Malloy from '@malloydata/malloy-interfaces';

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
  return new SingleConnectionRuntime({connection: conn}).loadModel(script);
}

export async function runQuery({
  script,
  source,
  view,
  connection,
}: QueryOptions) {
  const urlReader: URLReader = {
    readURL: async _url => {
      return script;
    },
  };
  const query: Malloy.Query = {
    definition: {
      kind: 'arrow',
      source: {
        kind: 'source_reference',
        name: source,
      },
      view: {
        kind: 'view_reference',
        name: view,
      },
    },
  };
  const lookupConnection: API.LookupConnection<API.Connection> = {
    async lookupConnection(_name: string) {
      return wrappedConnection;
    },
  };
  const conn = await connection;
  const wrappedConnection = API.util.wrapLegacyConnection(conn);
  const result = await API.asynchronous.runQuery(
    {
      model_url: 'file:///script.malloy',
      query,
    },
    {
      urls: urlReader,
      connections: lookupConnection,
    }
  );
  if (result.logs?.some(l => l.severity === 'error')) {
    throw new Error(JSON.stringify(result.logs));
  }
  return result.result!;
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
