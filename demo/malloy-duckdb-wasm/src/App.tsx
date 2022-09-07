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
import { Field, Model, Runtime } from "@malloydata/malloy";
import { HTMLView } from "@malloydata/render";
import { DuckDBWASMConnection } from "@malloydata/db-duckdb-wasm";
import { Controls } from "./Controls";
import { Query } from "./Query";
import { Results } from "./Results";
import { ModelView } from "./ModelView";
import { Status } from "./Status";
import { BrowserURLReader } from "./utils/files";
import { DuckDBWasmLookup } from "./utils/connections";
import { HackyDataStylesAccumulator } from "./utils/data_styles";
import { Sample } from "./types";
import { SchemaView } from "./SchemaView";
import { loadSampleQueries, SampleQuery } from "./utils/query";

const baseReader = new BrowserURLReader();
const lookup = new DuckDBWasmLookup();
const reader = new HackyDataStylesAccumulator(baseReader);
const runtime = new Runtime(reader, lookup);

export const App: React.FC = () => {
  // Editor contents
  const [loadedModel, setLoadedModel] = useState("");
  const [loadedQuery, setLoadedQuery] = useState("");

  // Result state
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState<HTMLElement>();

  // Select sample UI
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sample, setSample] = useState<Sample>();
  const [model, setModel] = useState<Model>();

  // Select query UI
  const [query, setQuery] = useState<SampleQuery>();
  const [queries, setQueries] = useState<SampleQuery[]>([]);

  // Runnable query data
  const [importFile, setImportFile] = useState("");
  const [editedQuery, setEditedQuery] = useState("");

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
        setModel(undefined);
        // Read model file
        const modelUrl = new URL(sample.modelPath, window.location.href);
        const malloyModel = await reader.readURL(modelUrl);
        setLoadedModel(malloyModel);

        // Read query samples file
        const queryUrl = new URL(sample.queryPath, window.location.href);
        const sampleQueries = await loadSampleQueries(queryUrl);

        setImportFile(sampleQueries.importFile);
        setQueries(sampleQueries.queries);
        setQuery(sampleQueries.queries[0]);
        setLoadedQuery(sampleQueries.queries[0].query);
        setEditedQuery(sampleQueries.queries[0].query);

        connection.database?.registerFileURL(
          sample.dataPath,
          new URL(sample.dataUrl, window.location.href).toString()
        );

        const model = await runtime.getModel(modelUrl);
        setModel(model);
      }
      setStatus("Ready");
    })();
  }, [sample]);

  // Sample Query load
  useEffect(() => {
    if (query) {
      setLoadedQuery(query.query);
      setEditedQuery(query.query);
    }
  }, [query]);

  // Run turtle
  const onFieldClick = useCallback(
    async (field: Field) => {
      if (sample && field.isQueryField()) {
        setStatus("Loading Model");
        setRendered(undefined);
        setError("");
        try {
          // Assuming simple one level path
          const query = `query: ${field.parentExplore.name} -> ${field.name}`;
          const modelUrl = new URL(sample.modelPath, window.location.href);
          const runnable = runtime.loadModel(modelUrl).loadQuery(query);
          setStatus("Loading Data");
          const rowLimit = (await runnable.getPreparedResult()).resultExplore
            .limit;
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
      }
    },
    [sample]
  );

  // Run query
  const onRun = useCallback(async () => {
    if (!samples || !query) {
      return;
    }
    setStatus("Loading Model");
    setRendered(undefined);
    setError("");
    try {
      const malloy = `import "${importFile}"\n${editedQuery}`;
      baseReader.setContents(window.location.href, malloy);
      const runnable = runtime
        .loadModel(new URL(window.location.href))
        .loadQueryByName(query.name);
      setStatus("Loading Data");
      const rowLimit = (await runnable.getPreparedResult()).resultExplore.limit;
      setStatus(`Running query ${query.name}`);
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
        <SchemaView model={model} onFieldClick={onFieldClick} />
        <Left>
          <Query
            queryPath={sample?.queryPath}
            query={loadedQuery}
            onChange={setEditedQuery}
          />
          <ModelView modelPath={sample?.modelPath} model={loadedModel} />
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
  width: 40%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Right = styled.div`
  flex: auto;
  height: 100%;
  width: 40%;
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
