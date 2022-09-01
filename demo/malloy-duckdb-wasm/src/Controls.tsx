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
import { Sample } from "./types";
import { SampleQuery } from "./utils/query";

interface ControlsProps {
  samples: Sample[];
  onSelectSample: (sample: Sample) => void;
  onRun: () => void;
  onSelectQuery: (sampleQuery: SampleQuery) => void;
  queries: SampleQuery[];
}

export const Controls: React.FC<ControlsProps> = ({
  samples,
  onSelectSample,
  queries,
  onRun,
  onSelectQuery,
}) => {
  const onSampleChange = useCallback(
    ({ target }) => {
      const sample = samples.find((sample) => sample.name == target.value);
      onSelectSample(sample || samples[0]);
    },
    [onSelectSample, samples]
  );

  const onQueryChange = useCallback(
    ({ target }) => {
      const query = queries.find((query) => query.name == target.value);
      onSelectQuery(query || queries[0]);
    },
    [onSelectQuery, queries]
  );

  return (
    <Bar>
      <SampleSection>
        <Label htmlFor="model-select">Data Set: </Label>
        <Select id="model-select" onChange={onSampleChange}>
          {samples.map((sample) => (
            <option key={sample.name} value={sample.name}>
              {sample.name}
            </option>
          ))}
        </Select>
      </SampleSection>
      <QuerySection>
        <Label htmlFor="query-select">Query: </Label>
        <Select id="query-select" onChange={onQueryChange}>
          {queries.map((query) => (
            <option key={query.name} value={query.name}>
              {query.name}
            </option>
          ))}
        </Select>
        <Run onClick={onRun}>Run</Run>
      </QuerySection>
    </Bar>
  );
};

const Bar = styled.div`
  display: flex;
  flex-direction: row;
  padding: 5px;
  width: 100%;
`;

const Select = styled.select`
  padding: 4px;
  flex: auto;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: bold;
  padding: 4px;
`;

const Button = styled.button`
  margin-left: 5px;
  width: 50px;
`;

const Run = styled(Button)``;

const SampleSection = styled.div`
  width: 20%;
  display: flex;
`;

const QuerySection = styled.div`
  width: 40%;
  display: flex;
  ${Label} {
    padding-left: 10px;
  }
`;
