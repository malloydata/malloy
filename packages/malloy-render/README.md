# Malloy

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
