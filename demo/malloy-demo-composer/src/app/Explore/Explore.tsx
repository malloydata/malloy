/*
 * Copyright 2021 Google LLC
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

import { useState } from "react";
import styled from "styled-components";
import { Analysis, Directory, Model } from "../../types";
import { useDirectory } from "../data/use_directory";
import { Button } from "../CommonElements";
import { MalloyLogo } from "../MalloyLogo";
import { ActionIcon } from "../ActionIcon";
import { DirectoryPicker } from "../DirectoryPicker";
import { HotKeys } from "react-hotkeys";
import { useTopValues } from "../data/use_top_values";
import { useOpenDirectory } from "../data/use_open_directory";
import { useQueryBuilder } from "../hooks";
import { ExploreQueryEditor } from "../ExploreQueryEditor";
import { MarkdownDocument } from "../MarkdownDocument";
import { compileModel } from "../../core/compile";

const KEY_MAP = {
  REMOVE_FIELDS: "command+k",
  RUN_QUERY: "command+enter",
};

export const Explore: React.FC = () => {
  const [analysis, setAnalysis] = useState<Analysis>();
  const { openDirectory, beginOpenDirectory } = useOpenDirectory();
  const directory = useDirectory(openDirectory);
  const {
    queryMalloy,
    queryName,
    clearQuery,
    runQuery,
    isRunning,
    clearResult,
    source,
    queryModifiers,
    querySummary,
    dataStyles,
    result,
  } = useQueryBuilder({
    analysis,
    setAnalysis,
    openDirectory,
  });
  const topValues = useTopValues(analysis);
  const [section, setSection] = useState("query");

  const loadQueryLink = (
    modelPath: string,
    sourceName: string,
    queryName: string
  ) => {
    let current: Directory | Model | Analysis | undefined = directory;
    // TODO I don't really know how to do this in the browser, so this is maybe wrong
    for (const segment of modelPath.split("/")) {
      if (segment === ".") {
        continue;
      } else if (current?.type !== "directory") {
        // TODO some kind of helpful error?
        return;
      } else {
        current = current.contents.find((item) => item.path === segment);
      }
    }
    if (current?.type !== "model") {
      return;
    }
    const model: Model = current;
    const source = model.sources.find((source) => source.name === sourceName);
    if (source === undefined) {
      return;
    }

    if (model.fullPath === analysis?.modelFullPath) {
      queryModifiers.clearQuery();
      queryModifiers.loadQuery(queryName);
      setSection("query");
    } else {
      const newSourceName = sourceName + "_analysis";
      const code = `import "file://${model.fullPath}"\n\n explore: ${newSourceName} is ${source.name} {}`;
      compileModel(model.modelDef, code).then((modelDef) => {
        const analysis: Analysis = {
          type: "analysis",
          malloy: code,
          path: undefined,
          fullPath: undefined,
          modelFullPath: model.fullPath,
          sourceName: newSourceName,
          modelDef,
          id: `${model.fullPath}/${source.name}`,
          dataStyles: model.dataStyles,
        };
        queryModifiers.loadQueryInNewAnalysis(analysis, queryName);
        setSection("query");
      });
    }
  };

  const selectAnalysis = (analysis: Analysis) => {
    setAnalysis(analysis);
    clearQuery(analysis);
  };

  const handlers = {
    REMOVE_FIELDS: () => clearQuery(),
    RUN_QUERY: runQuery,
  };

  return (
    <Main handlers={handlers} keyMap={KEY_MAP}>
      <Header>
        <HeaderLeft>
          <MalloyLogo />
          <DirectoryPicker
            directory={directory}
            analysis={analysis}
            selectAnalysis={selectAnalysis}
          />
          <ActionIcon
            action="open-directory"
            onClick={beginOpenDirectory}
            color="dimension"
          />
        </HeaderLeft>
        {!isRunning && <Button onClick={() => runQuery()}>Run</Button>}
        {isRunning && (
          <Button onClick={() => clearResult()} color="primary" outline={true}>
            Cancel
          </Button>
        )}
      </Header>
      <Body>
        <Content>
          <SideSidebar>
            <button onClick={() => setSection("query")}>Query</button>
            <button onClick={() => setSection("about")}>About</button>
          </SideSidebar>
          {section === "query" && (
            <ExploreQueryEditor
              source={source}
              analysis={analysis}
              queryModifiers={queryModifiers}
              topValues={topValues}
              queryName={queryName}
              querySummary={querySummary}
              queryMalloy={queryMalloy}
              dataStyles={dataStyles}
              result={result}
              isRunning={isRunning}
            />
          )}
          {section === "about" && directory?.readme && (
            <ScrollContent>
              <div>
                <MarkdownDocument
                  content={directory?.readme}
                  loadQueryLink={loadQueryLink}
                />
              </div>
            </ScrollContent>
          )}
        </Content>
      </Body>
    </Main>
  );
};

const Main = styled(HotKeys)`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  outline: none;
`;

const Body = styled.div`
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
`;

const Content = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
`;

const SideSidebar = styled.div`
  width: 70px;
  min-width: 70px;
  border-right: 1px solid #efefef;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  height: 40px;
  border-bottom: 1px solid #efefef;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 20px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const ScrollContent = styled(Content)`
  overflow-y: auto;
`;
