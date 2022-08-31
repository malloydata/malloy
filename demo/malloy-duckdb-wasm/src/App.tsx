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
import { Controls } from "./Controls";
import { Query } from "./Query";
import { Results } from "./Results";
import { Model } from "./Model";
import { Status } from "./Status";
import { BrowserURLReader } from "./utils/files";
import { DuckDBWasmLookup } from "./utils/connections";
import { HackyDataStylesAccumulator } from "./utils/data_styles";
import { Sample } from "./types";

const baseReader = new BrowserURLReader();
const lookup = new DuckDBWasmLookup();
const reader = new HackyDataStylesAccumulator(baseReader);
const runtime = new Runtime(reader, lookup);

export const App: React.FC = () => {
  const [loadedModel, setLoadedModel] = useState("");
  const [loadedQuery, setLoadedQuery] = useState("");

  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("j_names");
  const [queries, setQueries] = useState<string[]>([]);
  const [editedQuery, setEditedQuery] = useState("");
  const [rendered, setRendered] = useState<HTMLElement>();
  const [error, setError] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sample, setSample] = useState<Sample>();

  // Initial load
  useEffect(() => {
    setStatus("Loading DuckDB");
    (async () => {
      const samplesResponse = await fetch("./samples.json");
      const samples = await samplesResponse.json();
      setSamples(samples);
      setSample(samples[0]);
    })();
  }, []);

  // Sample load
  useEffect(() => {
    setStatus("Loading Sample");
    (async () => {
      // Ensure duckdb is loaded
      const connection = (await lookup.lookupConnection(
        "duckdb"
      )) as DuckDBWASMConnection;
      if (sample) {
        const queries = [];
        // Read model file
        const modelUrl = new URL(sample.modelPath, window.location.href);
        const malloyModel = await reader.readURL(modelUrl);

        const queryUrl = new URL(sample.queryPath, window.location.href);
        const queryData = await reader.readURL(queryUrl);
        setLoadedQuery(queryData);
        setEditedQuery(queryData);

        const symbols = Malloy.parse({
          source: queryData,
        }).symbols;
        for (const symbol of symbols) {
          if (symbol.type === "query") {
            queries.push(symbol.name);
          }
        }
        setLoadedModel(malloyModel);
        setQueries(queries);
        setQuery(queries[0]);

        connection.database?.registerFileURL(
          sample.dataPath,
          new URL(sample.dataUrl, window.location.href).toString()
        );
      }
      setStatus("Ready");
    })();
  }, [sample]);

  useEffect(() => {
    const queries = [];
    const symbols = Malloy.parse({
      source: editedQuery,
    }).symbols;
    for (const symbol of symbols) {
      if (symbol.type === "query") {
        queries.push(symbol.name);
      }
    }
    setQueries(queries);
    setQuery(queries[0]);
  }, [editedQuery]);

  // Run query
  const onRun = useCallback(async () => {
    setStatus("Loading Model");
    setRendered(undefined);
    setError("");
    try {
      //const modelUrl = new URL(model, window.location.href);
      // const runnable = runtime.loadModel(modelUrl).loadQueryByName(query);
      baseReader.setContents(window.location.href, editedQuery);
      const runnable = runtime
        .loadModel(new URL(window.location.href))
        .loadQueryByName(query);
      setStatus("Loading Data");
      const rowLimit = (await runnable.getPreparedResult()).resultExplore.limit;
      setStatus(`Running query ${query}`);
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
  }, [editedQuery, query]);

  return (
    <React.StrictMode>
      <h1>
        <Logo src="logo.png" />
        Malloy DuckDB WASM Query Demo
      </h1>
      <Controls
        samples={samples}
        onSelectSample={setSample}
        onSelectQuery={setQuery}
        queries={queries}
        onRun={onRun}
      />
      <View>
        <Left>
          <Query
            queryPath={sample?.queryPath}
            query={loadedQuery}
            onChange={setEditedQuery}
          />
          <Model modelPath={sample?.modelPath} model={loadedModel} />
        </Left>
        <Right>
          {rendered ? (
            <Results rendered={rendered} />
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
  display: flex;
  flex-direction: column;
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
