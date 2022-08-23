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
import React, {
  DOMElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import { CopyHTMLButton } from "./CopyHTMLButton";
import { Scroll } from "./Scroll";

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
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [observer, setObserver] = useState<MutationObserver>();
  const tooltipId = useRef(0);
  const { setTooltipRef, setTriggerRef, getTooltipProps } = usePopperTooltip({
    visible: tooltipVisible,
    placement: "top",
  });

  const vscode = useQueryVSCodeContext();

  useEffect(() => {
    vscode.postMessage({ type: "app-ready" } as QueryPanelMessage);
  }, []);

  const themeCallback = useCallback(() => {
    const themeKind = document.body.dataset.vscodeThemeKind;
    setDarkMode(themeKind === "vscode-dark");
  }, []);

  useEffect(() => {
    const obs = new MutationObserver(themeCallback);
    setObserver(obs);
  }, [themeCallback, setObserver]);

  useEffect(() => {
    if (!observer) return;
    observer.observe(document.body, {
      attributeFilter: ["data-vscode-theme-kind"],
    });
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [observer, document.body]);

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
                isDrillingEnabled: false,
                onDrill: (drillQuery, target) => {
                  navigator.clipboard.writeText(drillQuery);
                  setTriggerRef(target);
                  setTooltipVisible(true);
                  const currentTooltipId = ++tooltipId.current;
                  setTimeout(() => {
                    if (currentTooltipId === tooltipId.current) {
                      setTooltipVisible(false);
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

  const copyHTMLTopClipboard = useCallback(
    ({ target }: MouseEvent) => {
      navigator.clipboard.writeText(getStyledHTML(html));
      setTriggerRef(target as HTMLElement);
      setTooltipVisible(true);
      const currentTooltipId = ++tooltipId.current;
      setTimeout(() => {
        if (currentTooltipId === tooltipId.current) {
          setTooltipVisible(false);
        }
      }, 1000);
    },
    [html]
  );

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
            <CopyHTMLButton onClick={copyHTMLTopClipboard} />
            <DOMElement element={html} />
          </div>
        </Scroll>
      )}
      {!error && resultKind === ResultKind.JSON && (
        <Scroll>
          <PrismContainer darkMode={darkMode} style={{ margin: "10px" }}>
            {json}
          </PrismContainer>
        </Scroll>
      )}
      {!error && resultKind === ResultKind.SQL && (
        <Scroll>
          <PrismContainer darkMode={darkMode} style={{ margin: "10px" }}>
            <div
              dangerouslySetInnerHTML={{ __html: sql }}
              style={{ margin: "10px" }}
            />
          </PrismContainer>
        </Scroll>
      )}
      {error && <Error multiline={error.includes("\n")}>{error}</Error>}
      {warning && <Warning>{warning}</Warning>}
      {tooltipVisible && (
        <Tooltip ref={setTooltipRef} {...getTooltipProps()}>
          Copied!
        </Tooltip>
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

function getStyledHTML(html: HTMLElement): string {
  const resolveStyles = getComputedStyle(html);
  const styles = `<style>
  :root {
    --malloy-font-family: ${resolveStyles.getPropertyValue(
      "--malloy-font-family"
    )};
    --malloy-title-color: ${resolveStyles.getPropertyValue(
      "--malloy-title-color"
    )};
    --malloy-label-color: ${resolveStyles.getPropertyValue(
      "--malloy-label-color"
    )};
    --malloy-border-color: ${resolveStyles.getPropertyValue(
      "--malloy-border-color"
    )};
    --malloy-tile-background-color: ${resolveStyles.getPropertyValue(
      "--malloy-tile-background-color"
    )};
  }
  body {
    color: ${resolveStyles.getPropertyValue("--foreground")};
    background: ${resolveStyles.getPropertyValue("--background")};
    font-family: var(--malloy-font-family);
    font-size: 11px;
  }
  table {
    font-size: 11px;
  }
</style>
`;
  return styles + html.outerHTML;
}

interface PrismContainerProps {
  darkMode: boolean;
}

const PrismContainer = styled.pre<PrismContainerProps>`
  font-family: source-code-pro, Menlo, Monaco, Consolas, "Courier New",
    monospace;
  font-size: 14px;
  color: ${(props) => (props.darkMode ? "#9cdcfe" : "#333388")};

  span.token.keyword {
    color: ${(props) => (props.darkMode ? "#c586c0" : "#af00db")};
  }

  span.token.comment {
    color: ${(props) => (props.darkMode ? "#6a9955" : "#4f984f")};
  }

  span.token.function,
  span.token.function_keyword {
    color: ${(props) => (props.darkMode ? "#ce9178" : "#795e26")};
  }

  span.token.string {
    color: ${(props) => (props.darkMode ? "#d16969" : "#ca4c4c")};
  }

  span.token.regular_expression {
    color: ${(props) => (props.darkMode ? "#f03e91" : "#88194d")};
  }

  span.token.operator,
  span.token.punctuation {
    color: ${(props) => (props.darkMode ? "#dadada" : "#505050")};
  }

  span.token.number {
    color: ${(props) => (props.darkMode ? "#4ec9b0" : "#09866a")};
  }

  span.token.type,
  span.token.timeframe {
    color: ${(props) => (props.darkMode ? "#569cd6 " : "#0070c1")};
  }

  span.token.date {
    color: ${(props) => (props.darkMode ? "#4ec9b0" : "#09866a")};
    /* color: ${(props) => (props.darkMode ? "#8730b3" : "#8730b3")};; */
  }

  span.token.property {
    color: ${(props) => (props.darkMode ? "#dcdcaa" : "#b98f13")};
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

const Tooltip = styled.div`
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
