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
  rendered: HTMLElement | undefined;
  sql: string | undefined;
  json: string | undefined;
}

export const Results: React.FC<RenderProps> = ({ json, sql, rendered }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState("HTML");

  useEffect(() => {
    const parent = ref.current;
    if (parent && rendered) {
      parent.innerHTML = "";
      parent.appendChild(rendered);
    }
  }, [rendered]);

  return (
    <Wrapper>
      <Top>
        <Title>Results:</Title>
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
      <Render ref={ref} style={{ display: tab === "HTML" ? "flex" : "none" }} />
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
  margin: 5px;
  height: calc(100% - 10px);
`;

const Render = styled.div`
  flex: auto;
  width: 100%;
  overflow-y: scroll;
  border: 1px inset;
  background: #ffffff;
`;

interface TabProps {
  selected: boolean;
}

const Tab = styled.div<TabProps>`
  border-top: 1px outset #888888;
  border-left: 1px outset #888888;
  border-right: 1px outset #888888;
  padding: 5px;
  margin-left: 3px;
  color: ${({ selected }) => (selected ? "#0000ee" : "inherit")};
`;

const Tabs = styled.div`
  display: flex;
  justify-content: flex-end;
  border-bottom: 1px solid var(--malloy-border-color);
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
