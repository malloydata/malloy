import {runtimeFor} from './runtimes';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line node/no-unpublished-import
import {parsePlotTags} from '../../packages/malloy-render/src/component/plot/parse-plot-tags';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line node/no-unpublished-import
import {plotToVega} from '../../packages/malloy-render/src/component/plot/plot-to-vega';

// Polyfill crypto for this test file
global.crypto = require('crypto');

const runtime = runtimeFor('duckdb');

describe('plot test', () => {
  test('Lifts embedded props', async () => {
    const loaded = runtime.loadQuery(
      `
        # plot
        run: duckdb.sql("SELECT 'a' as category, 1 as price, 2 as quantity, 3 as cost") -> {
          # x
          group_by: category
          # barY
          aggregate: \`sum price\` is price.sum()
        }
      `
    );
    const result = await loaded.run();
    const plotSpec = parsePlotTags(result);
    const vlSpec = plotToVega(plotSpec);
    console.log(JSON.stringify(plotSpec, null, 2));
    console.log(JSON.stringify(vlSpec, null, 2));
  });

  test('stack color', async () => {
    const loaded = runtime.loadQuery(
      `
        # plot
        run: duckdb.sql("SELECT 'a' as category, 'b' as region, 1 as price, 2 as quantity, 3 as cost") -> {
          # x
          group_by: category, region
          aggregate:
            # barY { fill='^region' }
            price is price.sum()
            quantity is quantity.sum()
        }
      `
    );
    const result = await loaded.run();
    const plotSpec = parsePlotTags(result);
    const vlSpec = plotToVega(plotSpec);
    console.log(JSON.stringify(plotSpec, null, 2));
    console.log(JSON.stringify(vlSpec, null, 2));
  });

  test('group color', async () => {
    const loaded = runtime.loadQuery(
      `
        # plot
        run: duckdb.sql("SELECT 'a' as category, 'b' as region, 1 as price, 2 as quantity, 3 as cost") -> {
          group_by:
            # fx
            category
            # x
            region
          aggregate:
            # barY { fill='^region' }
            price is price.sum()
            quantity is quantity.sum()
        }
      `
    );
    const result = await loaded.run();
    const plotSpec = parsePlotTags(result);
    const vlSpec = plotToVega(plotSpec);
    console.log(JSON.stringify(plotSpec, null, 2));
    console.log(JSON.stringify(vlSpec, null, 2));
  });

  test('stack measures', async () => {
    const loaded = runtime.loadQuery(
      `
        # plot.lists.l=[price,quantity]
        # plot.x=category
        # plot.marks.bar=barY { y.list=l fill.list=l }
        run: duckdb.sql("SELECT 'a' as category, 'b' as region, 1 as price, 2 as quantity, 3 as cost") -> {
          group_by: category
          aggregate:

            price is price.sum()
            quantity is quantity.sum()
        }
      `
    );
    const result = await loaded.run();
    const plotSpec = parsePlotTags(result);
    const vlSpec = plotToVega(plotSpec);
    console.log(JSON.stringify(plotSpec, null, 2));
    console.log(JSON.stringify(vlSpec, null, 2));
  });

  test.only('group measures', async () => {
    const loaded = runtime.loadQuery(
      `
        # plot.lists.l=[price,quantity]
        # plot.fx=category
        # plot.x.list=l
        # plot.marks.bar=barY { y.list=l fill.list=l }
        run: duckdb.sql("SELECT 'a' as category, 'b' as region, 1 as price, 2 as quantity, 3 as cost") -> {
          group_by: category
          aggregate:
            price is price.sum()
            quantity is quantity.sum()
        }
      `
    );
    const result = await loaded.run();
    const plotSpec = parsePlotTags(result);
    const vlSpec = plotToVega(plotSpec);
    console.log(JSON.stringify(plotSpec, null, 2));
    console.log(JSON.stringify(vlSpec, null, 2));
  });

  test.skip('embedded view', async () => {
    const loaded = runtime.loadQuery(
      `
        source: s is duckdb.sql("SELECT 'a' as category, 1 as price, 2 as quantity, 3 as cost") extend {
          # plot.axis.hidden
          view: t is {
            # x
            group_by: category
            # barY
            aggregate: price is price.sum()
          }
        }
        # -plot.axis.hidden
        run: s -> t
      `
    );
    const result = await loaded.run();
    const plotSpec = parsePlotTags(result);
    console.log(JSON.stringify(plotSpec, null, 2));
  });
});
