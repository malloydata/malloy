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
import styled, { createGlobalStyle } from "styled-components";
import { Field, Model, Result, Runtime } from "@malloydata/malloy";
import { HTMLView } from "@malloydata/render";
import { DuckDBWASMConnection } from "@malloydata/db-duckdb/src/duckdb_wasm_connection";
import { Query } from "./Query";
import { Results } from "./Results";
import { ModelSelect } from "./ModelSelect";
import { ModelView } from "./ModelView";
import { Status } from "./Status";
import { BrowserURLReader } from "./utils/files";
import { DuckDBWasmLookup } from "./utils/connections";
import { HackyDataStylesAccumulator } from "./utils/data_styles";
import { Sample } from "./types";
import { SchemaView } from "./SchemaView";
import { loadSampleQueries, SampleQuery } from "./utils/query";
import { QuerySelect } from "./QuerySelect";
import { Run } from "./Run";

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
  const [editedQuery, setEditedQuery] = useState("");
  const [autoRun, setAutoRun] = useState(false);

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
      setAutoRun(true);
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
      if (editedQuery !== loadedQuery) {
        updateSearchParam("t", editedQuery);
      }
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
      setResult(undefined);
      setError(error.message);
    }
  }, [editedQuery, sample, query]);

  useEffect(() => {
    if (autoRun) {
      onRun();
      setAutoRun(false);
    }
  }, [autoRun, onRun]);

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
      <GlobalStyle />
      <Header>
        <TitleSection>
          <Logo src="logo.png" />
          <Title htmlFor="model-select">Malloy Fiddle</Title>
          <Divider />
          <ModelSelect
            samples={samples}
            selectedSample={sample}
            onSelectSample={onSelectSample}
          />
          <QuerySelect
            onSelectQuery={onSelectQuery}
            selectedQuery={query}
            queries={queries}
          />
        </TitleSection>
        <Run onRun={onRun} />
      </Header>
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
          {rendered || error ? (
            <Results
              error={error}
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
      <Footer>
        <DocsLinks>
          Learn More!
          <DocsLink href={DOCS_LINK} target="_blank">
            <img src="media/more_info_docs.svg" />
            Docs
          </DocsLink>
          <DocsLink href={REPO_LINK} target="_blank">
            <img src="media/more_info_github.svg" />
            Github
          </DocsLink>
          <DocsLink href={VSCODE_INSTALL_LINK} target="_blank">
            <img src="media/more_info_vsc.svg" />
            VSCode
          </DocsLink>
          <DocsLink href={SLACK_LINK} target="_blank">
            <img src="media/more_info_slack.svg" />
            Slack
          </DocsLink>
        </DocsLinks>
      </Footer>
    </React.StrictMode>
  );
};

const Logo = styled.img`
  height: 25px;
  width: 25px;
  padding: 10px;
`;

const Left = styled.div`
  flex: auto;
  height: 100%;
  width: calc(40% - 128px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Right = styled.div`
  flex: auto;
  height: 100%;
  width: calc(60% - 128px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const View = styled.div`
  display: flex;
  flex-direction: row;
  height: calc(100vh - 100px);
`;

const Header = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const Footer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const DocsLinks = styled.div`
  display: flex;
  flex-direction: row;
  color: #000000;
  font-size: 14px;
  padding: 10px 0;
  align-items: center;
  img {
    width: 20px;
    height: 20px;
    margin-right: 5px;
  }
`;

const DocsLink = styled.a`
  display: flex;
  flex-direction: row;
  font-size: 14px;
  align-items: center;
  padding: 0 10px;
  text-decoration: none;
  img {
    width: 20px;
    height: 20px;
  }
`;

const Title = styled.label`
  font-size: 18px;
  padding: 5px;
  line-height: 36px;
`;

const TitleSection = styled.div`
  display: flex;
  flex-direction: row;
`;

const Divider = styled.div`
  display: inline-block;
  height: 25px;
  margin: 10px;
  border-left: 1px solid #a7aab3;
`;

const GlobalStyle = createGlobalStyle`
  body {
    color: #595959;
    background: #f7f9fb;
    font-family: var(--malloy-font-family);
    font-size: 11px;
    overflow: hidden;
    margin: 15px 20px;
  }
  table {
    font-size: 11px;
  }
  a {
    color: #188ff9;
  }
`;
