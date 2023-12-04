import {LoaderFunction, Args} from '@storybook/types';
import {HtmlRenderer} from '@storybook/html';
import {SingleConnectionRuntime} from '@malloydata/malloy';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';

export type QueryOptions = {
  script: string;
  source: string;
  view: string;
  connection: Promise<DuckDBWASMConnection>;
};

export function createLoader(
  script: string
): LoaderFunction<HtmlRenderer, Args> {
  return async context => ({
    result: await runQuery({
      script,
      source: context.args['source'],
      view: context.args['view'],
      connection: context.globals['connection'],
    }),
  });
}

export async function runQuery({
  script,
  source,
  view,
  connection,
}: QueryOptions) {
  const conn = await connection;
  const runtime = new SingleConnectionRuntime(conn);
  const model = runtime.loadModel(script);
  const runner = model.loadQuery(`run: ${source} -> ${view}`);
  const result = await runner.run();
  return result;
}
