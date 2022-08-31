/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { Malloy, Runtime } from "@malloydata/malloy";
import { HTMLView } from "@malloydata/render";
import { DuckDBWASMConnection } from "@malloydata/db-duckdb-wasm";
import { ModelControls, QueryControls } from "./Controls";
import { Query } from "./Query";
import { Render } from "./Render";
import { Model } from "./Model";
import { Status } from "./Status";
import { BrowserURLReader } from "./utils/files";
import { DuckDBWasmLookup } from "./utils/connections";
import { HackyDataStylesAccumulator } from "./utils/data_styles";

const DATA_PATH = "data/usa_names.parquet";
const DATA_URL = new URL("./dist/usa_names.parquet", window.location.href);

const MODELS = [
  "1_names.malloy",
  "2_iconic_names.malloy",
  "3_names_dashboards.malloy",
];

const QUERY = `import "./1_names.malloy"

query: j_names is names -> name_dashboard {? name ~ r'J'}
`;

const baseReader = new BrowserURLReader();
const lookup = new DuckDBWasmLookup();
const reader = new HackyDataStylesAccumulator(baseReader);
const runtime = new Runtime(reader, lookup);

export const App: React.FC = () => {
  const [malloyModel, setMalloyModel] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("j_names");
  const [queries, setQueries] = useState<string[]>([]);
  const [editedQuery, setEditedQuery] = useState(QUERY);
  const [rendered, setRendered] = useState<HTMLElement>();
  const [model, setModel] = useState(MODELS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus("Loading Model");
    (async () => {
      await lookup.lookupConnection("duckdb");
      const queries = [];
      const modelUrl = new URL(model, window.location.href);
      const malloyModel = await reader.readURL(modelUrl);
      const symbols = Malloy.parse({
        source: malloyModel,
      }).symbols;
      for (const symbol of symbols) {
        if (symbol.type === "query") {
          queries.push(symbol.name);
        }
      }
      setMalloyModel(malloyModel);
      setQueries(queries);
      setQuery(queries[0]);
      setStatus("Ready");
    })();
  }, [model]);

  useEffect(() => {
    setStatus("Loading DuckDB");
    (async () => {
      const nameUrl = DATA_URL;
      const connection = (await lookup.lookupConnection(
        "duckdb"
      )) as DuckDBWASMConnection;
      connection.database?.registerFileURL(DATA_PATH, nameUrl.toString());
    })();
  }, []);

  const onRun = useCallback(async () => {
    setStatus("Loading Model");
    setRendered(undefined);
    setError("");
    try {
      //const modelUrl = new URL(model, window.location.href);
      // const runnable = runtime.loadModel(modelUrl).loadQueryByName(query);
      const queries = [];
      const symbols = Malloy.parse({
        source: editedQuery,
      }).symbols;
      for (const symbol of symbols) {
        if (symbol.type === "query") {
          queries.push(symbol.name);
        }
      }
      if (!queries.length) {
        throw new Error("Please define a query");
      }
      baseReader.setContents(window.location.href, editedQuery);
      const runnable = runtime
        .loadModel(new URL(window.location.href))
        .loadQueryByName(queries[0]);
      setStatus("Loading Data");
      const rowLimit = (await runnable.getPreparedResult()).resultExplore.limit;
      setStatus(`Running query ${queries[0]}`);
      const result = await runnable.run({ rowLimit });
      setStatus("Rendering");
      const rendered = await new HTMLView(document).render(result.data, {
        dataStyles: reader.getHackyAccumulatedDataStyles(),
      });
      setStatus("Done");
      setRendered(rendered);
    } catch (error) {
      setStatus("Error");
      setError(error.message);
    }
  }, [model, editedQuery]);

  return (
    <React.StrictMode>
      <h1>
        <Logo src="logo.png" />
        Malloy DuckDB WASM Query Demo
      </h1>
      <ModelControls models={MODELS} onSelectModel={setModel} />
      <View>
        <Left>
          <Model model={malloyModel} />
          <QueryControls
            onSelectQuery={setQuery}
            queries={queries}
            onRun={onRun}
          />
          <Query query={QUERY} onChange={setEditedQuery} />
        </Left>
        <Right>
          {rendered ? (
            <Render rendered={rendered} />
          ) : (
            <Status status={status} />
          )}
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </Right>
      </View>
    </React.StrictMode>
  );
};

const Logo = styled.img`
  width: 24px;
  position: relative;
  padding-right: 5px;
  top: 5px;
`;

const Left = styled.div`
  flex: auto;
  height: 100%;
  width: 50%;
  overflow: hidden;
`;

const Right = styled.div`
  flex: auto;
  height: 100%;
  width: 50%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ErrorMessage = styled.div`
  margin-left: 5px;
  padding: 5px;
  background-color: #fbb;
  font-size: 12px;
  color: #4b4c50;
  border-radius: 5px;
  white-space: pre-wrap;
  font-family: "Roboto Mono", monospace;
`;

const View = styled.div`
  display: flex;
  flex-direction: row;
  height: 90vh;
`;
