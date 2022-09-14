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

import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Editor } from "./Editor";
import { Title } from "./Title";

export interface RenderProps {
  error: string | undefined;
  rendered: HTMLElement | undefined;
  sql: string | undefined;
  json: string | undefined;
}

export const Results: React.FC<RenderProps> = ({
  error,
  json,
  sql,
  rendered,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState("HTML");

  useEffect(() => {
    const parent = ref.current;
    if (parent && rendered) {
      parent.innerHTML = "";
      parent.appendChild(rendered);
    }
  }, [rendered]);

  useEffect(() => {
    if (error) {
      setTab("HTML");
    }
  }, [error]);

  return (
    <Wrapper>
      <Top>
        <Title>Results</Title>
        <Tabs>
          <Tab selected={tab === "HTML"} onClick={() => setTab("HTML")}>
            HTML
          </Tab>
          <Tab selected={tab === "JSON"} onClick={() => setTab("JSON")}>
            JSON
          </Tab>
          <Tab selected={tab === "SQL"} onClick={() => setTab("SQL")}>
            SQL
          </Tab>
        </Tabs>
      </Top>
      <Render
        ref={ref}
        style={{ display: tab === "HTML" && !error ? "block" : "none" }}
      />
      <ErrorMessage
        style={{ display: tab === "HTML" && error ? "block" : "none" }}
      >
        {error}
      </ErrorMessage>
      <JSON style={{ display: tab === "JSON" ? "flex" : "none" }}>
        <Editor value={json || ""} language="json" readOnly={true} />
      </JSON>
      <SQL style={{ display: tab === "SQL" ? "flex" : "none" }}>
        <Editor value={sql || ""} language="sql" readOnly={true} />
      </SQL>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin: 5px 5px 5px 10px;
  height: calc(100% - 10px);
`;

const ErrorMessage = styled.div`
  padding: 5px;
  background-color: #ffffff;
  font-size: 11px;
  color: #ff0000;
  white-space: pre-wrap;
  font-family: "Roboto Mono", monospace;
  height: 100%;
`;

const Render = styled.div`
  flex: auto;
  width: calc(100% - 10px);
  overflow-y: scroll;
  background: #ffffff;
  padding: 13px;
`;

interface TabProps {
  selected: boolean;
}

const Tab = styled.div<TabProps>`
  padding: 5px;
  margin-left: 15px;
  color: ${({ selected }) => (selected ? "#188ff9" : "inherit")};
  cursor: pointer;
`;

const Tabs = styled.div`
  display: flex;
  justify-content: flex-end;
  font-size: 13px;
`;

const JSON = styled.div`
  display: flex;
  flex: auto;
`;

const SQL = styled.div`
  display: flex;
  flex: auto;
`;

const Top = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;
