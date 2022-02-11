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

import React from "react";
import styled from "styled-components";

export enum ResultKind {
  HTML = "html",
  JSON = "json",
  SQL = "sql",
}

interface ResultKindToggleProps {
  kind: ResultKind;
  setKind: (kind: ResultKind) => void;
}

export const ResultKindToggle: React.FC<ResultKindToggleProps> = ({
  kind,
  setKind,
}) => {
  return (
    <ResultControlsBar>
      <ResultLabel>QUERY RESULTS</ResultLabel>
      <ResultControls>
        <ResultControl
          data-selected={kind === ResultKind.HTML}
          onClick={() => setKind(ResultKind.HTML)}
        >
          HTML
        </ResultControl>
        <ResultControl
          data-selected={kind === ResultKind.JSON}
          onClick={() => setKind(ResultKind.JSON)}
        >
          JSON
        </ResultControl>
        <ResultControl
          data-selected={kind === ResultKind.SQL}
          onClick={() => setKind(ResultKind.SQL)}
        >
          SQL
        </ResultControl>
      </ResultControls>
    </ResultControlsBar>
  );
};

const ResultControlsBar = styled.div`
  display: flex;
  border-bottom: 1px solid #efefef;
  justify-content: space-between;
  align-items: center;
  color: #b1b1b1;
`;

const ResultLabel = styled.span`
  font-weight: 500;
  font-size: 12px;
  padding: 0 10px;
`;

const ResultControls = styled.div`
  display: flex;
  justify-content: end;
  padding: 5px 5px 0 5px;
  font-size: 12px;
  gap: 3px;
`;

const ResultControl = styled.button`
  border: 0;
  border-bottom: 1px solid white;
  cursor: pointer;
  background-color: white;
  padding: 3px 5px;
  color: #b1b1b1;

  &:hover,
  &[data-selected="true"] {
    border-bottom: 1px solid #4285f4;
    color: #4285f4;
  }
`;
