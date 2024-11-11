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

export async function copyMalloyRenderHTML(element: Element) {
  let html = '';
  if (element.shadowRoot) {
    let styles = '';
    for (let stylesheet of [...element.shadowRoot.adoptedStyleSheets]) {
      for (let i = 0; i < stylesheet.cssRules.length; i++) {
        const cssRule = stylesheet.cssRules.item(i);
        if (cssRule) styles += `\n` + cssRule.cssText;
      }

      // @ts-ignore
      styles = styles.replaceAll(':host', '.malloy_html_host');
      const shadowStyle = element.getAttribute('style');
      html = `<div>
  <style>${styles}</style>
  <div class="XXX_malloy_html_host">
  <div class="malloy_html_host" style="${shadowStyle}">
    ${element.shadowRoot.innerHTML}</div>
  </div>
</div>`;
    }
  } else html = element.innerHTML;

  try {
    await navigator.clipboard.writeText(html);
  } catch (error) {
    console.error('Failed to copy text: ', error);
  }
}
