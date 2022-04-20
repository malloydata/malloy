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
import { numberFilterChangeType } from "../../core/filters";
import {
  NumberCustomFilter,
  NumberFilter,
  NumberFilterType,
  NumberEqualToFilter,
  NumberNotEqualToFilter,
  NumberGreaterThanFilter,
  NumberLessThanFilter,
  NumberGreaterThanOrEqualToFilter,
  NumberLessThanOrEqualToFilter,
  NumberBetweenFilter,
} from "../../types";
import { CodeInput } from "../CodeInput";
import { NumberInput } from "../NumberInput";
import { PillInput } from "../PillInput/PillInput";
import { SelectDropdown } from "../SelectDropdown";

interface NumberFilterBuilderProps {
  filter: NumberFilter;
  setFilter: (filter: NumberFilter) => void;
}

export const NumberFilterBuilder: React.FC<NumberFilterBuilderProps> = ({
  filter,
  setFilter,
}) => {
  const changeType = (type: NumberFilterType) => {
    setFilter(numberFilterChangeType(filter, type));
  };

  const typeDropdown = (
    <SelectDropdown
      value={filter.type}
      onChange={changeType}
      options={
        [
          { value: "is_equal_to", label: "Equal to" },
          { value: "is_greater_than", label: "Greater than" },
          { value: "is_less_than", label: "Less than" },
          {
            value: "is_greater_than_or_equal_to",
            label: "Greater than or equal to",
          },
          { value: "is_less_than_or_equal_to", label: "Less than or equal to" },
          { value: "is_between", label: "Between" },
          { value: "is_null", label: "Null" },
          { value: "is_not_equal_to", label: "Not equal to" },
          { value: "is_not_null", label: "Not null" },
          { value: "custom", label: "Custom" },
        ] as { value: NumberFilterType; label: string }[]
      }
    />
  );

  const equalTo = useNumberEqualToBuilder(filter, setFilter, typeDropdown);
  const notEqualTo = useNumberNotEqualToBuilder(
    filter,
    setFilter,
    typeDropdown
  );
  const greaterThan = useNumberGreaterThanBuilder(
    filter,
    setFilter,
    typeDropdown
  );
  const lessThan = useNumberLessThanFilter(filter, setFilter, typeDropdown);
  const greaterThanOrEqualTo = useNumberGreaterThanOrEqualToBuilder(
    filter,
    setFilter,
    typeDropdown
  );
  const lessThanOrEqualTo = useNumberLessThanOrEqualToFilter(
    filter,
    setFilter,
    typeDropdown
  );
  const between = useNumberBetweenBuilder(filter, setFilter, typeDropdown);
  const custom = useNumberCustomBuilder(filter, setFilter, typeDropdown);
  const noBuilder =
    filter.type === "is_null" || filter.type === "is_not_null" ? (
      <div style={{ width: "100%" }}>{typeDropdown}</div>
    ) : null;

  return (
    <BuilderRow>
      {equalTo.builder}
      {notEqualTo.builder}
      {greaterThan.builder}
      {lessThan.builder}
      {greaterThanOrEqualTo.builder}
      {lessThanOrEqualTo.builder}
      {between.builder}
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

const Row = styled.div`
  display: flex;
  gap: 10px;
  flex-direction: row;
  width: 100%;
`;

const Column = styled.div`
  display: flex;
  gap: 10px;
  flex-direction: column;
  width: 100%;
`;

function useNumberEqualToBuilder(
  filter: NumberFilter,
  setFilter: (filter: NumberEqualToFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_equal_to") {
    return { builder: null, util: null };
  }

  const builder = (
    <Column>
      {typeDropdown}
      <PillInput
        values={filter.values.map((n) => n.toString())}
        setValues={(values) =>
          setFilter({ ...filter, values: values.map((v) => parseFloat(v)) })
        }
        placeholder="Values..."
        type="number"
      />
    </Column>
  );
  return { builder };
}

function useNumberNotEqualToBuilder(
  filter: NumberFilter,
  setFilter: (filter: NumberNotEqualToFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_not_equal_to") {
    return { builder: null, util: null };
  }

  const builder = (
    <Column>
      {typeDropdown}
      <PillInput
        values={filter.values.map((n) => n.toString())}
        setValues={(values) =>
          setFilter({ ...filter, values: values.map((v) => parseFloat(v)) })
        }
        placeholder="Values..."
        type="number"
      />
    </Column>
  );
  return { builder };
}

function useNumberGreaterThanBuilder(
  filter: NumberFilter,
  setFilter: (filter: NumberGreaterThanFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_greater_than") {
    return { builder: null, util: null };
  }

  const builder = (
    <Row>
      <div style={{ width: "50%", flexShrink: 1 }}>{typeDropdown}</div>
      <div style={{ width: "50%", flexShrink: 1 }}>
        <NumberInput
          value={filter.value}
          setValue={(value) => setFilter({ ...filter, value })}
        />
      </div>
    </Row>
  );
  return { builder };
}

function useNumberLessThanFilter(
  filter: NumberFilter,
  setFilter: (filter: NumberLessThanFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_less_than") {
    return { builder: null, util: null };
  }

  const builder = (
    <Row>
      <div style={{ width: "50%", flexShrink: 1 }}>{typeDropdown}</div>
      <div style={{ width: "50%", flexShrink: 1 }}>
        <NumberInput
          value={filter.value}
          setValue={(value) => setFilter({ ...filter, value })}
        />
      </div>
    </Row>
  );
  return { builder };
}

function useNumberGreaterThanOrEqualToBuilder(
  filter: NumberFilter,
  setFilter: (filter: NumberGreaterThanOrEqualToFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_greater_than_or_equal_to") {
    return { builder: null, util: null };
  }

  const builder = (
    <Row>
      <div style={{ width: "80%", flexShrink: 1 }}>{typeDropdown}</div>
      <div style={{ width: "20%", flexShrink: 1 }}>
        <NumberInput
          value={filter.value}
          setValue={(value) => setFilter({ ...filter, value })}
        />
      </div>
    </Row>
  );
  return { builder };
}

function useNumberLessThanOrEqualToFilter(
  filter: NumberFilter,
  setFilter: (filter: NumberLessThanOrEqualToFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_less_than_or_equal_to") {
    return { builder: null, util: null };
  }

  const builder = (
    <Row>
      <div style={{ width: "70%", flexShrink: 1 }}>{typeDropdown}</div>
      <div style={{ width: "30%", flexShrink: 1 }}>
        <NumberInput
          value={filter.value}
          setValue={(value) => setFilter({ ...filter, value })}
        />
      </div>
    </Row>
  );
  return { builder };
}

function useNumberBetweenBuilder(
  filter: NumberFilter,
  setFilter: (filter: NumberBetweenFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_between") {
    return { builder: null, util: null };
  }

  const builder = (
    <Column>
      {typeDropdown}
      <Row>
        <div style={{ width: "50%", flexShrink: 1 }}>
          <NumberInput
            value={filter.lowerBound}
            setValue={(lowerBound) => setFilter({ ...filter, lowerBound })}
          />
        </div>
        <div style={{ width: "50%", flexShrink: 1 }}>
          <NumberInput
            value={filter.upperBound}
            setValue={(upperBound) => setFilter({ ...filter, upperBound })}
          />
        </div>
      </Row>
    </Column>
  );
  return { builder };
}

function useNumberCustomBuilder(
  filter: NumberFilter,
  setFilter: (filter: NumberCustomFilter) => void,
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
