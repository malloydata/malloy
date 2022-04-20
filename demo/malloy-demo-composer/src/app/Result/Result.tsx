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

import { useEffect, useRef, useState } from "react";
import * as malloy from "@malloydata/malloy";
import * as render from "@malloydata/render";
import styled from "styled-components";
import { LoadingSpinner } from "../Spinner";
import { Analysis } from "../../types";
import { usePrevious } from "../hooks";
import { highlightPre } from "../utils";

interface ResultProps {
  result?: malloy.Result;
  analysis: Analysis;
  dataStyles: render.DataStyles;
  malloy: string;
}

export const Result: React.FC<ResultProps> = ({
  result,
  analysis,
  dataStyles,
  malloy,
}) => {
  const [html, setHTML] = useState<HTMLElement>();
  const [highlightedMalloy, setHighlightedMalloy] = useState<HTMLElement>();
  const [sql, setSQL] = useState<HTMLElement>();
  const [view, setView] = useState<"sql" | "malloy" | "html">("html");
  const [rendering, setRendering] = useState(false);
  const [displaying, setDisplaying] = useState(false);
  const resultId = useRef(0);
  const previousResult = usePrevious(result);
  const previousDataStyles = usePrevious(dataStyles);

  useEffect(() => {
    highlightPre(malloy, "malloy")
      .then(setHighlightedMalloy)
      // eslint-disable-next-line no-console
      .catch(console.log);
  }, [malloy]);

  useEffect(() => {
    if (result === previousResult && dataStyles === previousDataStyles) {
      return;
    }
    setRendering(false);
    setDisplaying(false);
    setHTML(undefined);
    if (result === undefined) {
      return;
    }
    setTimeout(async () => {
      setRendering(true);
      highlightPre(result.sql, "sql").then(setSQL);
      // eslint-disable-next-line no-console
      console.log(result.sql);
      const currentResultId = ++resultId.current;
      const rendered = await new render.HTMLView(document).render(result.data, {
        dataStyles: { ...analysis.dataStyles, ...dataStyles },
        isDrillingEnabled: false,
        onDrill: () => {
          // This is where I would put drilling behavior, if I had any!
        },
      });
      setTimeout(() => {
        if (resultId.current !== currentResultId) {
          return;
        }
        setRendering(false);
        setDisplaying(true);
        setTimeout(() => {
          if (resultId.current !== currentResultId) {
            return;
          }
          setHTML(rendered);
        }, 0);
      }, 0);
    });
  }, [result, dataStyles, analysis, previousDataStyles, previousResult]);

  return (
    <OuterDiv>
      <Header>
        <ViewTab onClick={() => setView("malloy")} selected={view === "malloy"}>
          Malloy
        </ViewTab>
        <ViewTab onClick={() => setView("sql")} selected={view === "sql"}>
          SQL
        </ViewTab>
        <ViewTab onClick={() => setView("html")} selected={view === "html"}>
          Results
        </ViewTab>
      </Header>
      <ContentDiv>
        {result === undefined && view !== "malloy" && (
          <LoadingSpinner text="Running" />
        )}
        {view === "html" && (
          <>
            {result !== undefined && rendering && (
              <LoadingSpinner text="Rendering" />
            )}
            {!html && displaying && <LoadingSpinner text="Displaying" />}
            {html && displaying && (
              <ResultWrapper>
                <DOMElement element={html} />
              </ResultWrapper>
            )}
          </>
        )}
        {result !== undefined && view === "sql" && (
          <PreWrapper>{sql && <DOMElement element={sql} />}</PreWrapper>
        )}
        {view === "malloy" && (
          <PreWrapper>
            {highlightedMalloy && <DOMElement element={highlightedMalloy} />}
          </PreWrapper>
        )}
      </ContentDiv>
    </OuterDiv>
  );
};

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

const ResultWrapper = styled.div`
  font-size: 14px;
  font-family: "Roboto Mono";
`;

const OuterDiv = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
`;

const ContentDiv = styled.div`
  padding: 20px;
  overflow: auto;
  height: 100%;
`;

const Header = styled.div`
  border-bottom: 1px solid #efefef;
  display: flex;
  flex-direction: row;
  gap: 10px;
  justify-content: flex-end;
  padding: 0px 20px;
  min-height: 35px;
  max-height: 35px;
`;

const ViewTab = styled.div<{
  selected: boolean;
}>`
  padding: 8px;
  cursor: pointer;
  text-transform: uppercase;
  color: #939393;
  font-family: "Google Sans";
  border-top: 1px solid transparent;
  font-size: 11pt;
  ${({ selected }) =>
    `border-bottom: 1px solid ${selected ? "#4285F4" : "transparent"}`}
`;

const PreWrapper = styled.div`
  border: 1px solid #efefef;
  padding: 0 15px;
  overflow: hidden;
  font-family: "Roboto Mono";
  font-size: 14px;
`;
