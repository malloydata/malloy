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

import { useEffect, useState } from "react";
import styled from "styled-components";
import { Analysis, Directory, Model } from "../../types";
import { useDirectory } from "../data/use_directory";
import { Button, PageContent } from "../CommonElements";
import { ChannelButton } from "../ChannelButton";
import { ErrorMessage } from "../ErrorMessage";
import { ActionIcon } from "../ActionIcon";
import { DirectoryPicker } from "../DirectoryPicker";
import { HotKeys } from "react-hotkeys";
import { useTopValues } from "../data/use_top_values";
import { useOpenDirectory } from "../data/use_open_directory";
import { useQueryBuilder } from "../hooks";
import { ExploreQueryEditor } from "../ExploreQueryEditor";
import { compileModel } from "../../core/compile";
import { COLORS } from "../colors";
import { MalloyLogo } from "../MalloyLogo";
import { MarkdownDocument } from "../MarkdownDocument";

const KEY_MAP = {
  REMOVE_FIELDS: "command+k",
  RUN_QUERY: "command+enter",
};

export const Explore: React.FC = () => {
  const [analysis, setAnalysis] = useState<Analysis>();
  const { openDirectory, beginOpenDirectory, isOpeningDirectory } =
    useOpenDirectory();
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
    error,
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
    // Note, this only works for relative paths like ./dir/model.malloy
    // and cannot go up the directory hierarchy. Therefore, it will only load
    // models in the same directory.
    for (const segment of modelPath.split("/")) {
      if (segment === ".") {
        continue;
      } else if (current?.type !== "directory") {
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
  };

  useEffect(() => {
    if (directory) {
      if (directory.readme) {
        setSection("about");
      }
      setAnalysis(undefined);
      clearQuery();
    }
  }, [directory]);

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
          <ActionIcon
            action="open-directory"
            onClick={() => {
              !isOpeningDirectory && beginOpenDirectory();
            }}
            color="dimension"
          />
          <DirectoryPicker
            directory={directory}
            analysis={analysis}
            selectAnalysis={selectAnalysis}
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
          <Channel>
            <ChannelTop>
              <ChannelButton
                onClick={() => setSection("query")}
                text="Query"
                icon="query"
                selected={section === "query"}
              ></ChannelButton>
              <ChannelButton
                onClick={() => setSection("about")}
                text="About"
                icon="about"
                selected={section === "about"}
                disabled={directory?.readme == undefined}
              ></ChannelButton>
            </ChannelTop>
            <ChannelBottom></ChannelBottom>
          </Channel>
          <Page>
            <PageContainer>
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
              {section === "about" && (
                <PageContent>
                  <MarkdownDocument
                    content={
                      directory?.readme ||
                      "# No Readme\nThis project has no readme"
                    }
                    loadQueryLink={loadQueryLink}
                  />
                </PageContent>
              )}
              <ErrorMessage error={error} />
            </PageContainer>
          </Page>
          <RightChannel />
        </Content>
      </Body>
      <BottomChannel />
    </Main>
  );
};

const Main = styled(HotKeys)`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  outline: none;
  background-color: ${COLORS.mainBackground};
`;

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 10px;
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
  background-color: ${COLORS.mainBackground};
`;

const Channel = styled.div`
  width: 70px;
  min-width: 70px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: ${COLORS.mainBackground};
  justify-content: space-between;
`;

const ChannelTop = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
`;

const ChannelBottom = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
`;

const Header = styled.div`
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px 5px 20px;
  background-color: ${COLORS.mainBackground};
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const ScrollContent = styled(Content)`
  overflow-y: auto;
  background-color: unset;
`;

const Page = styled(Content)``;

const RightChannel = styled.div`
  width: 10px;
  min-width: 10px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: ${COLORS.mainBackground};
`;

const BottomChannel = styled.div`
  width: 100%;
  min-height: 10px;
  height: 10px;
  display: flex;
  flex-direction: column;
  background-color: ${COLORS.mainBackground};
`;
