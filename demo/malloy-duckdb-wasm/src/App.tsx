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
import { Field, Model, Result, Runtime } from "@malloydata/malloy";
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

const DOCS_LINK = "https://looker-open-source.github.io/malloy/documentation/";
const REPO_LINK = "https://github.com/looker-open-source/malloy/";
const SLACK_LINK =
  "https://join.slack.com/t/malloy-community/shared_invite/zt-upi18gic-W2saeFu~VfaVM1~HIerJ7w";
const VSCODE_INSTALL_LINK =
  "https://github.com/looker-open-source/malloy/blob/main/README.md";

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
  const [result, setResult] = useState<Result>();
  const [rendered, setRendered] = useState<HTMLElement>();

  // Select sample UI
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sample, setSample] = useState<Sample>();
  const [model, setModel] = useState<Model>();

  // Select query UI
  const [query, setQuery] = useState<SampleQuery>();
  const [queries, setQueries] = useState<SampleQuery[]>([]);

  // Runnable query data
  const [_importFile, setImportFile] = useState("");
  const [editedQuery, setEditedQuery] = useState("");

  const [search, setSearch] = useState(window.location.search);

  const updateSearchParam = (name: string, value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    history.replaceState("", "", url);
    setSearch(url.search);
  };

  // Initial load
  useEffect(() => {
    setStatus("Loading DuckDB");
    (async () => {
      const samplesResponse = await fetch("./samples.json");
      const samples = await samplesResponse.json();
      setSamples(samples);
      const params = new URLSearchParams(search);
      const modelName = params.get("m");
      let sample = samples[0];
      if (modelName) {
        for (const s of samples) {
          if (s.name === modelName) {
            sample = s;
          }
        }
      }
      setSample(sample);
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

        let sampleQuery = sampleQueries.queries[0];
        const params = new URLSearchParams(search);
        const queryName = params.get("q");
        if (queryName) {
          for (const q of sampleQueries.queries) {
            if (q.name === queryName) {
              sampleQuery = q;
            }
          }
        }
        const queryText = params.get("t") || sampleQuery?.query || "";
        setImportFile(sampleQueries.importFile);
        setQueries(sampleQueries.queries);
        setQuery(sampleQuery);
        setLoadedQuery(queryText);
        setEditedQuery(queryText);

        for (const tableName of sample.dataTables) {
          connection.database?.registerFileURL(
            tableName,
            new URL(tableName, window.location.href).toString()
          );
        }

        const model = await runtime.getModel(modelUrl);
        setModel(model);
        updateSearchParam("m", sample.name);
        setSample(sample);
      }
      setStatus("Ready");
    })();
  }, [sample]);

  // Sample Query load
  useEffect(() => {
    if (query) {
      const params = new URLSearchParams(search);
      const queryText = params.get("t") || query?.query || "";
      setLoadedQuery(queryText);
      setEditedQuery(queryText);
      updateSearchParam("q", query.name);
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
          setResult(result);
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
    if (!sample) {
      return;
    }
    setStatus("Loading Model");
    setRendered(undefined);
    setError("");
    try {
      const runnable = runtime
        .loadModel(new URL(sample.modelPath, window.location.href))
        .loadQuery(editedQuery);
      setStatus("Loading Data");
      updateSearchParam("t", editedQuery);
      const rowLimit = (await runnable.getPreparedResult()).resultExplore.limit;
      setStatus(`Running query`);
      const result = await runnable.run({ rowLimit });
      setResult(result);
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
  }, [editedQuery, sample, query]);

  const onSelectSample = useCallback((sample: Sample) => {
    setSample(sample);
    updateSearchParam("t", "");
  }, []);

  const onSelectQuery = useCallback((query: SampleQuery) => {
    setQuery(query);
    updateSearchParam("t", "");
  }, []);

  return (
    <React.StrictMode>
      <Header>
        <h1>
          <Logo src="logo.png" />
          Malloy Fiddle
        </h1>
        <DocsLink>
          <a href={DOCS_LINK} target="_blank">
            Malloy Documentation
          </a>
          <br />
          <a href={REPO_LINK} target="_blank">
            Malloy Repository on Github
          </a>
          <br />
          <a href={VSCODE_INSTALL_LINK} target="_blank">
            Malloy VSCode Installation
          </a>
          <br />
          <a href={SLACK_LINK} target="_blank">
            Join the Malloy Slack Community
          </a>
        </DocsLink>
      </Header>
      <Controls
        samples={samples}
        selectedSample={sample}
        onSelectSample={onSelectSample}
        onSelectQuery={onSelectQuery}
        queries={queries}
        selectedQuery={query}
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
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          {rendered ? (
            <Results
              rendered={rendered}
              sql={result?.sql}
              json={
                result
                  ? JSON.stringify(result._queryResult.result, null, 2)
                  : undefined
              }
            />
          ) : (
            <Status status={status} />
          )}
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

const Header = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const DocsLink = styled.div`
  float: right;
  color: #000000;
  font-size: 14px;
`;
