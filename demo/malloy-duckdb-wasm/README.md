# Malloy duckdb-wasm Demo (Malloy Fiddle)

The Malloy duckdb-wasm demo is a self-contained web application that allows people to test out the functionality of Malloy without having to download any code or set up any database connections, and to demonstrate how Malloy and DuckDB can be combined for interactive data exploration in a browser. [duckdb-wasm](https://github.com/duckdb/duckdb-wasm) is a web assembly version of the [DuckDB](https://duckdb.org) database that is supported by Malloy.

There is a live version of this demo on our documentation website [here](https://looker-open-source.github.io/malloy/fiddle/index.html).

## Building the Demo

### Install Malloy

Start by [Building the Malloy repo](https://github.com/looker-open-source/malloy/blob/main/developing.md). Install the dependencies in that link, then in the top-level `malloy/` directory, run:

1. `npm install` to install dependencies
2. `npm run build` to build all the libraries Malloy needs

### Building and Running the Demo

You can then build or run the demo. First change into the `demo/malloy-duckdb-wasm` directory. Then

```
npm run build
```

will create all the files needed for the standalone demo in the `docs` directory.

Additionally,

```
npm start
```

will start up a development web server on port 8888 that will allow you to use the demo at `http://your-hostname:8888`

### Deploying the demo

If you wish to create your own demo website, after you have completed `npm run build`, you can copy the contents of the `docs` directory to an available web server. There are no additional dependencies.

## About the Sample Malloy files

All the samples used in the demo are stored in the `docs` directory. Each sample consists of a sample [Parquet](https://parquet.apache.org/) or CSV data file, a model file, and a query file. They are indexed in `docs/sample.json`.

### The sample.json File

The main index of samples is stored in `docs/sample.json`. The format of the sample file is an array of sample entry. Each sample entry looks like this:

```json
  {
    "name": "Airports",
    "dataTables": ["airports.parquet"],
    "modelPath": "./airports.malloy",
    "queryPath": "./airports-queries.malloy"
  },
```

`name` is the display name that appears in the "Data Set" dropdown menu. `dataTables` is an array of data files, either Parquet or CVS that are used with this sample. `modelPath` is the path to the Malloy model file that is to be used
with the sample queries. `queryPath` is the path to the set of Malloy queries that is used with the sample.

### The Model File

The model file should contain the Malloy model that your sample queries are based on. Typically this means creating a data source from your sample data,
and defining the dimensions, measures and other model features. You can define multiple sources if you have including multiple data tables.

```malloy
source: airports is table('duckdb:airports.parquet') {
  measure:
    airport_count is count()
    percent_of_all_airports is airport_count/all(airport_count)*100
    avg_elevation is elevation.avg()
    heliport_count is airport_count {? fac_type = 'HELIPORT'}

  query: by_state is {
    where: state != null
    group_by: state
    aggregate: airport_count
  }

  query: by_facility_type is {
    group_by: fac_type
    aggregate:
      airport_count
      avg_elevation
  }
}
```

### The Query File

The query file has the following format:

```malloy
import "./airports.malloy"

// --
// Name: Show all Data
// The Equivqalent of a SELECT * in SQL.

query: airports -> {
  project: *
}

// --
// Name: Filtering Data
//  New York City District Airports

query: airports -> {
  where: faa_dist = 'NYC'
  project: *
}
```

The first part, `import "./flights.malloy"`, imports the model file. Following the the import are the set of sample queries. Each query is separated by a `// --` comment. The next line should be the display name of the query that is to appear in the "Query" dropdown menu. This syntax is designed to allow the file to be directly edited in the [Malloy VSCode extension](https://marketplace.visualstudio.com/items?itemName=malloydata.malloy-vscode).

Following that is a Malloy query that will be run. There can also be Malloy modeling code, but it is recommended that modeling is kept in the model file. If there is more than one query, only the last one will be run.

### The Data Files

The data files can be [Parquet](https://parquet.apache.org/) files, CSV files or
a combination of both. Because of browser memory constraints, some data sets
may be too large for in browser use, or for complex queries. Hosting your data sets o
