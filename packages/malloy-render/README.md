# Malloy X

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently connects to BigQuery and Postgres, and natively supports DuckDB. We've built a Visual Studio Code extension to facilitate building Malloy data models, querying and transforming data, and creating simple visualizations and dashboards.

## This package

This package provides a simple mechanism to render charts based on results from using the `malloydata/malloy` library. See [here](https://github.com/malloydata/malloy/blob/main/packages/malloy/README.md) for additional information.

## Developing locally with Storybook

Run `npm run storybook` to launch a Storybook app in your browser. This app will hot reload as you make changes to the renderer source.

Stories are written in the `src/stories` directory. To add more data and Malloy files for your stories to consume, you must:

- put .malloy files in `src/stories/static`
- put data files in `src/stories/static/data`
- register data files be loaded into the DuckDB WASM connection by adding the file name to `.storybook/registered_data.json`

[Take a look at the Basic story as an example.](./src/stories/basic.stories.ts)

### On Reloading Changes

When running `npm run storybook`, only changes in the malloy-render package will hot reload properly. Changes to dependencies like the core `malloy` package may require a browser reload to work properly.

## Using the Bundled Renderer

Any web browser with JSON results from a DB query execution and a PreparedResult object from the Malloy library should be able to use the bundled renderer to create an HTML Malloy Result. The renderer bundle is available from v0.0.118 onwards. Example usage:

```js
var script = document.createElement('script');
script.src =
  'https://cdn.jsdelivr.net/npm/@malloydata/render@0.0.118/dist/bundle/bundled_renderer.min.js';
document.head.appendChild(script);
var resultElement = document.getElementById('result_div');
renderMalloyResults(result, total_rows, preparedResult).then(
  function (malloyResElement) {
    resultElement.appendChild(malloyResElement);
  }
);
```

To build the bundle from source, run `npm run bundle_renderer`. This will create the bundled js files in in `dist/bundle`.
