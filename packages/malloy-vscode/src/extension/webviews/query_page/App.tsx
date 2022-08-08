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

import { Result } from "@malloydata/malloy";
import { HTMLView } from "@malloydata/render";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  QueryMessageType,
  QueryPanelMessage,
  QueryRunStatus,
} from "../../message_types";
import { Spinner } from "../components";
import { ResultKind, ResultKindToggle } from "./ResultKindToggle";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-sql";
import { usePopperTooltip } from "react-popper-tooltip";
import { useQueryVSCodeContext } from "./query_vscode_context";
import { DownloadButton } from "./DownloadButton";

enum Status {
  Ready = "ready",
  Compiling = "compiling",
  Running = "running",
  Error = "error",
  Displaying = "displaying",
  Rendering = "rendering",
  Done = "done",
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.Ready);
  const [html, setHTML] = useState<HTMLElement>(document.createElement("span"));
  const [json, setJSON] = useState("");
  const [sql, setSQL] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [resultKind, setResultKind] = useState<ResultKind>(ResultKind.HTML);
  const [drillTooltipVisible, setDrillTooltipVisible] = useState(false);
  const drillTooltipId = useRef(0);
  const { setTooltipRef, setTriggerRef, getTooltipProps } = usePopperTooltip({
    visible: drillTooltipVisible,
    placement: "top",
  });

  const vscode = useQueryVSCodeContext();

  useEffect(() => {
    vscode.postMessage({ type: "app-ready" } as QueryPanelMessage);
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent<QueryPanelMessage>) => {
      const message = event.data;

      switch (message.type) {
        case QueryMessageType.QueryStatus:
          if (message.status === QueryRunStatus.Error) {
            setStatus(Status.Error);
            setError(message.error);
          } else {
            setError(undefined);
          }
          if (message.status === QueryRunStatus.Done) {
            setWarning(undefined);
            setStatus(Status.Rendering);
            setTimeout(async () => {
              const result = Result.fromJSON(message.result);
              const data = result.data;
              setJSON(JSON.stringify(data.toObject(), null, 2));
              setSQL(
                Prism.highlight(result.sql, Prism.languages["sql"], "sql")
              );
              const rendered = await new HTMLView(document).render(data, {
                dataStyles: message.styles,
                isDrillingEnabled: true,
                onDrill: (drillQuery, target) => {
                  navigator.clipboard.writeText(drillQuery);
                  setTriggerRef(target);
                  setDrillTooltipVisible(true);
                  const currentDrillTooltipId = ++drillTooltipId.current;
                  setTimeout(() => {
                    if (currentDrillTooltipId === drillTooltipId.current) {
                      setDrillTooltipVisible(false);
                    }
                  }, 1000);
                },
              });
              setStatus(Status.Displaying);
              setTimeout(() => {
                setHTML(rendered);
                if (data.rowCount < result.totalRows) {
                  const rowCount = data.rowCount.toLocaleString();
                  const totalRows = result.totalRows.toLocaleString();
                  setWarning(
                    `Row limit hit. Viewing ${rowCount} of ${totalRows} results.`
                  );
                }
                setStatus(Status.Done);
              }, 0);
            }, 0);
          } else {
            setHTML(document.createElement("span"));
            setJSON("");
            setSQL("");
            switch (message.status) {
              case QueryRunStatus.Compiling:
                setStatus(Status.Compiling);
                break;
              case QueryRunStatus.Running:
                setStatus(Status.Running);
                break;
            }
          }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  return (
    <div
      style={{
        height: "100%",
        margin: "0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {[
        Status.Compiling,
        Status.Running,
        Status.Rendering,
        Status.Displaying,
      ].includes(status) ? (
        <Spinner text={getStatusLabel(status) || ""} />
      ) : (
        ""
      )}
      {!error && (
        <ResultControlsBar>
          <ResultLabel>QUERY RESULTS</ResultLabel>
          <ResultControlsItems>
            <ResultKindToggle kind={resultKind} setKind={setResultKind} />
            <DownloadButton
              onDownload={async (downloadOptions) => {
                vscode.postMessage({
                  type: QueryMessageType.StartDownload,
                  downloadOptions,
                });
              }}
            />
          </ResultControlsItems>
        </ResultControlsBar>
      )}
      {!error && resultKind === ResultKind.HTML && (
        <Scroll>
          <div style={{ margin: "10px" }}>
            <DOMElement element={html} />
          </div>
        </Scroll>
      )}
      {!error && resultKind === ResultKind.JSON && (
        <Scroll>
          <PrismContainer style={{ margin: "10px" }}>{json}</PrismContainer>
        </Scroll>
      )}
      {!error && resultKind === ResultKind.SQL && (
        <Scroll>
          <PrismContainer style={{ margin: "10px" }}>
            <div
              dangerouslySetInnerHTML={{ __html: sql }}
              style={{ margin: "10px" }}
            />
          </PrismContainer>
        </Scroll>
      )}
      {error && <Error multiline={error.includes("\n")}>{error}</Error>}
      {warning && <Warning>{warning}</Warning>}
      {drillTooltipVisible && (
        <DrillTooltip ref={setTooltipRef} {...getTooltipProps()}>
          Drill copied!
        </DrillTooltip>
      )}
    </div>
  );
};

function getStatusLabel(status: Status) {
  switch (status) {
    case Status.Compiling:
      return "Compiling";
    case Status.Running:
      return "Running";
    case Status.Rendering:
      return "Rendering";
    case Status.Displaying:
      return "Displaying";
  }
}

const Scroll = styled.div`
  height: 100%;
  overflow: auto;
`;

const PrismContainer = styled.pre`
  font-family: source-code-pro, Menlo, Monaco, Consolas, "Courier New",
    monospace;
  font-size: 14px;
  color: #333388;

  span.token.keyword {
    color: #af00db;
  }

  span.token.comment {
    color: #4f984f;
  }

  span.token.function,
  span.token.function_keyword {
    color: #795e26;
  }

  span.token.string {
    color: #ca4c4c;
  }

  span.token.regular_expression {
    color: #88194d;
  }

  span.token.operator,
  span.token.punctuation {
    color: #505050;
  }

  span.token.number {
    color: #09866a;
  }

  span.token.type,
  span.token.timeframe {
    color: #0070c1;
  }

  span.token.date {
    color: #09866a;
    /* color: #8730b3; */
  }

  span.token.property {
    color: #b98f13;
  }
`;

const DOMElement: React.FC<{ element: HTMLElement }> = ({ element }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = ref.current;
    if (parent) {
      parent.innerHTML = "";
      parent.appendChild(element);
    }
  }, [element]);

  return <div ref={ref}></div>;
};

const DrillTooltip = styled.div`
  background-color: #505050;
  color: white;
  border-radius: 5px;
  box-shadow: rgb(144 144 144) 0px 1px 5px 0px;
  padding: 5px;
`;

const Warning = styled.div`
  color: var(--vscode-statusBarItem-warningForeground);
  background-color: var(--vscode-statusBarItem-warningBackground);
  padding: 5px;
`;

interface ErrorProps {
  multiline: boolean;
}

const Error = styled.div<ErrorProps>`
  background-color: var(--vscode-inputValidation-errorBackground);
  padding: 5px;
  white-space: ${(props) => (props.multiline ? "pre" : "normal")};
  font-family: ${(props) => (props.multiline ? "monospace" : "inherit")};
  font-size: var(--vscode-editor-font-size);
`;

const ResultControlsBar = styled.div`
  display: flex;
  border-bottom: 1px solid #efefef;
  justify-content: space-between;
  align-items: center;
  color: #b1b1b1;
  padding: 0 10px;
  user-select: none;
`;

const ResultLabel = styled.span`
  font-weight: 500;
  font-size: 12px;
`;

const ResultControlsItems = styled.div`
  display: flex;
  align-items: center;
`;
