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

import { ReactElement } from "react";
import styled from "styled-components";
import { booleanFilterChangeType } from "../../core/filters";
import {
  BooleanCustomFilter,
  BooleanFilter,
  BooleanFilterType,
} from "../../types";
import { CodeInput } from "../CodeInput";
import { SelectDropdown } from "../SelectDropdown";

interface BooleanFilterBuilderProps {
  filter: BooleanFilter;
  setFilter: (filter: BooleanFilter) => void;
}

export const BooleanFilterBuilder: React.FC<BooleanFilterBuilderProps> = ({
  filter,
  setFilter,
}) => {
  const changeType = (type: BooleanFilterType) => {
    setFilter(booleanFilterChangeType(filter, type));
  };

  const typeDropdown = (
    <SelectDropdown
      value={filter.type}
      onChange={changeType}
      options={
        [
          { value: "is_true", label: "True" },
          { value: "is_false", label: "False" },
          { value: "is_null", label: "Null" },
          { value: "is_not_null", label: "Not null" },
          { value: "is_true_or_null", label: "True or null" },
          { value: "is_false_or_null", label: "False or null" },
          { value: "custom", label: "Custom" },
        ] as { value: BooleanFilterType; label: string }[]
      }
    />
  );

  const custom = useBooleanCustomBuilder(filter, setFilter, typeDropdown);
  const noBuilder =
    filter.type !== "custom" ? (
      <div style={{ width: "100%" }}>{typeDropdown}</div>
    ) : null;

  return (
    <BuilderRow>
      {custom.builder}
      {noBuilder}
    </BuilderRow>
  );
};

const BuilderRow = styled.div`
  display: flex;
  gap: 10px;
  flex-direction: row;
  padding: 0 15px;
  width: calc(100% - 30px);
`;

const Column = styled.div`
  display: flex;
  gap: 10px;
  flex-direction: column;
  width: 100%;
`;

function useBooleanCustomBuilder(
  filter: BooleanFilter,
  setFilter: (filter: BooleanCustomFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "custom") {
    return { builder: null, util: null };
  }

  const builder = (
    <Column>
      {typeDropdown}
      <CodeInput
        value={filter.partial}
        setValue={(partial) => setFilter({ type: "custom", partial })}
        placeholder="!= null"
      />
    </Column>
  );

  return { builder };
}
