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

interface ModelControlsProps {
  models: string[];
  onSelectModel: (model: string) => void;
}

export const ModelControls: React.FC<ModelControlsProps> = ({
  models,
  onSelectModel,
}) => {
  const onModelChange = useCallback(
    ({ target }) => {
      onSelectModel(target.value);
    },
    [onSelectModel]
  );

  return (
    <Bar>
      <Label htmlFor="model-select">Model: </Label>
      <Select id="model-select" onChange={onModelChange}>
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </Select>
    </Bar>
  );
};

export interface QueryControlsParams {
  onRun: () => void;
  onSelectQuery: (model: string) => void;
  queries: string[];
}

export const QueryControls: React.FC<QueryControlsParams> = ({
  queries,
  onRun,
  onSelectQuery,
}) => {
  const onQueryChange = useCallback(
    ({ target }) => {
      onSelectQuery(target.value);
    },
    [onSelectQuery]
  );

  return (
    <Bar>
      <Label htmlFor="query-select">Query: </Label>
      <Select id="query-select" onChange={onQueryChange}>
        {queries.map((query) => (
          <option key={query} value={query}>
            {query}
          </option>
        ))}
      </Select>
      <Run onClick={onRun}>Run</Run>
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
  width: 400px;
`;

const Button = styled.button`
  margin-left: 5px;
  width: 50px;
`;

const Run = styled(Button)`
  float: right;
`;
