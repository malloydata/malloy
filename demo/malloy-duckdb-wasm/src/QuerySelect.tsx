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
import { SampleQuery } from "./utils/query";

interface QuerySelectProps {
  onSelectQuery: (sampleQuery: SampleQuery) => void;
  queries: SampleQuery[];
  selectedQuery: SampleQuery | undefined;
}

export const QuerySelect: React.FC<QuerySelectProps> = ({
  queries,
  onSelectQuery,
  selectedQuery,
}) => {
  const onQueryChange = useCallback(
    ({ target }) => {
      const query = queries.find((query) => query.name == target.value);
      onSelectQuery(query || queries[0]);
    },
    [onSelectQuery, queries]
  );

  return (
    <QuerySection>
      <Label htmlFor="query-select">Queries: </Label>
      <Select
        id="query-select"
        onChange={onQueryChange}
        value={selectedQuery?.name}
      >
        {queries.map((query) => (
          <option key={query.name} value={query.name}>
            {query.name}
          </option>
        ))}
      </Select>
    </QuerySection>
  );
};

const Select = styled.select`
  padding-left: 5px;
  background: none;
  border: 0;
  color: #188ff9;
  flex: auto;
`;

const Label = styled.label`
  font-size: 14px;
`;

const QuerySection = styled.div`
  display: flex;
  align-items: center;
  ${Label} {
    padding-left: 20px;
  }
`;
