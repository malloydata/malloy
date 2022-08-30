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

import React, { useCallback } from "react";
import styled from "styled-components";

interface ControlsProps {
  files: string[];
  onRun: () => void;
  onSelectFile: (file: string) => void;
  onSelectQuery: (file: string) => void;
  queries: string[];
}

export const Controls: React.FC<ControlsProps> = ({
  files,
  queries,
  onRun,
  onSelectFile,
  onSelectQuery,
}) => {
  const onFileChange = useCallback(
    ({ target }) => {
      onSelectFile(target.value);
    },
    [onSelectFile]
  );

  const onQueryChange = useCallback(
    ({ target }) => {
      onSelectQuery(target.value);
    },
    [onSelectFile]
  );

  return (
    <Bar>
      <Label htmlFor="file-select">File: </Label>
      <Select id="file-select" onChange={onFileChange}>
        {files.map((file) => (
          <option key={file} value={file}>
            {file}
          </option>
        ))}
      </Select>
      <Label htmlFor="query-select">Query: </Label>
      <Select id="query-select" onChange={onQueryChange}>
        {queries.map((query) => (
          <option key={query} value={query}>
            {query}
          </option>
        ))}
      </Select>
      <Button onClick={onRun}>Run</Button>
    </Bar>
  );
};

const Bar = styled.div`
  display: flex;
  flex-direction: row;
  padding: 5px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: bold;
  padding: 4px;
`;

const Select = styled.select`
  padding: 4px;
  width: 200px;
`;

const Button = styled.button`
  margin-left: 5px;
  width: 50px;
`;
