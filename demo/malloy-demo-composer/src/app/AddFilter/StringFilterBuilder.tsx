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

import { StructDef } from "@malloydata/malloy";
import { useState } from "react";
import styled from "styled-components";
import { stringFilterChangeType } from "../../core/filters";
import {
  StringContainsFilter,
  StringCustomFilter,
  StringEndsWithFilter,
  StringEqualToFilter,
  StringFilter,
  StringFilterType,
  StringNotContainsFilter,
  StringNotEndsWithFilter,
  StringNotEqualToFilter,
  StringNotStartsWithFilter,
  StringStartsWithFilter,
} from "../../types";
import { ActionIcon } from "../ActionIcon";
import { CodeInput } from "../CodeInput";
import {
  ContextMenuContent,
  EmptyMessage,
  ScrollMain,
} from "../CommonElements";
import { useSearch } from "../data";
import { FieldButton } from "../FieldButton";
import { PillInput } from "../PillInput/PillInput";
import { SelectDropdown } from "../SelectDropdown";
import { LoadingSpinner } from "../Spinner";
import { largeNumberLabel } from "../utils";

interface StringFilterBuilderProps {
  source: StructDef;
  fieldPath: string;
  filter: StringFilter;
  setFilter: (filter: StringFilter) => void;
}

export const StringFilterBuilder: React.FC<StringFilterBuilderProps> = ({
  source,
  filter,
  setFilter,
  fieldPath,
}) => {
  const changeType = (type: StringFilterType) => {
    setFilter(stringFilterChangeType(filter, type));
  };

  const equalTo = useStringEqualToOrNotBuilder(
    source,
    filter,
    setFilter,
    fieldPath
  );
  const startsWith = useStringContainsBuilder(filter, setFilter);
  const doesNotStartWith = useStringNotContainsBuilder(filter, setFilter);
  const contains = useStringStartsWithBuilder(filter, setFilter);
  const doesNotContain = useStringNotStartsWithBuilder(filter, setFilter);
  const endsWith = useStringEndsWithBuilder(filter, setFilter);
  const doesNotEndWith = useStringNotEndsWithBuilder(filter, setFilter);
  const custom = useStringCustomBuilder(filter, setFilter);

  const showUtilRow = !!(
    equalTo.util ||
    startsWith.util ||
    doesNotStartWith.util ||
    contains.util ||
    doesNotContain.util ||
    endsWith.util ||
    doesNotEndWith.util ||
    custom.util
  );

  return (
    <div>
      <BuilderRow>
        <SelectDropdown
          value={filter.type}
          onChange={changeType}
          options={
            [
              { value: "is_equal_to", label: "Is" },
              { value: "starts_with", label: "Starts with" },
              { value: "ends_with", label: "Ends with" },
              { value: "contains", label: "Contains" },
              { value: "is_blank", label: "Blank" },
              { value: "is_null", label: "Null" },
              { value: "is_not_equal_to", label: "Is not" },
              { value: "does_not_start_with", label: "Does not start with" },
              { value: "does_not_end_with", label: "Does not end with" },
              { value: "does_not_contain", label: "Does not contain" },
              { value: "is_not_blank", label: "Not blank" },
              { value: "is_not_null", label: "Not null" },
              { value: "custom", label: "Custom" },
            ] as { value: StringFilterType; label: string }[]
          }
        />
        {equalTo.builder}
        {startsWith.builder}
        {doesNotStartWith.builder}
        {contains.builder}
        {doesNotContain.builder}
        {endsWith.builder}
        {doesNotEndWith.builder}
        {custom.builder}
      </BuilderRow>
      {showUtilRow && (
        <UtilRow>
          {equalTo.util}
          {startsWith.util}
          {doesNotStartWith.util}
          {contains.util}
          {doesNotContain.util}
          {endsWith.util}
          {doesNotEndWith.util}
          {custom.util}
        </UtilRow>
      )}
    </div>
  );
};

const BuilderRow = styled.div`
  display: flex;
  gap: 10px;
  flex-direction: column;
  padding: 0 15px;
`;

const UtilRow = styled.div`
  margin-top: 15px;
  border-top: 1px solid #efefef;
  border-bottom: 1px solid #efefef;
`;

function useStringEqualToOrNotBuilder(
  source: StructDef,
  filter: StringFilter,
  setFilter: (filter: StringEqualToFilter | StringNotEqualToFilter) => void,
  fieldPath: string
) {
  const [searchValue, setSearchValue] = useState("");
  const { searchResults, isLoading } = useSearch(
    source,
    searchValue,
    fieldPath
  );
  if (filter.type !== "is_equal_to" && filter.type !== "is_not_equal_to") {
    return { builder: null, util: null };
  }

  const builder = (
    <PillInput
      values={filter.values}
      setValues={(values) => setFilter({ ...filter, values })}
      placeholder="Values..."
      value={searchValue}
      setValue={setSearchValue}
    />
  );
  const util = (
    <ScrollMain>
      <ContextMenuContent>
        {searchResults &&
          searchResults.length > 0 &&
          searchResults.map((searchResult, index) => {
            return (
              <FieldButton
                key={index}
                name={searchResult.fieldValue}
                detail={largeNumberLabel(searchResult.weight)}
                icon={<ActionIcon action="filter" />}
                color="filter"
                onClick={() => {
                  setFilter({
                    ...filter,
                    values: [...filter.values, searchResult.fieldValue],
                  });
                  setSearchValue("");
                }}
                fullDetail={true}
              />
            );
          })}
        {searchResults !== undefined && searchResults.length === 0 && (
          <EmptyMessage>No value results</EmptyMessage>
        )}
        {isLoading && (
          <EmptyMessage>
            <LoadingSpinner text="Loading value results..." />
          </EmptyMessage>
        )}
      </ContextMenuContent>
    </ScrollMain>
  );
  return { builder, util };
}

function useStringContainsBuilder(
  filter: StringFilter,
  setFilter: (filter: StringContainsFilter) => void
) {
  if (filter.type !== "contains") {
    return { builder: null, util: null };
  }

  const builder = (
    <PillInput
      values={filter.values}
      setValues={(values) => setFilter({ ...filter, values })}
      placeholder="Values..."
    />
  );
  const util = null;
  return { builder, util };
}

function useStringNotContainsBuilder(
  filter: StringFilter,
  setFilter: (filter: StringNotContainsFilter) => void
) {
  if (filter.type !== "does_not_contain") {
    return { builder: null, util: null };
  }

  const builder = (
    <PillInput
      values={filter.values}
      setValues={(values) => setFilter({ ...filter, values })}
      placeholder="Values..."
    />
  );
  const util = null;
  return { builder, util };
}

function useStringStartsWithBuilder(
  filter: StringFilter,
  setFilter: (filter: StringStartsWithFilter) => void
) {
  if (filter.type !== "starts_with") {
    return { builder: null, util: null };
  }

  const builder = (
    <PillInput
      values={filter.values}
      setValues={(values) => setFilter({ ...filter, values })}
      placeholder="Values..."
    />
  );
  const util = null;
  return { builder, util };
}

function useStringNotStartsWithBuilder(
  filter: StringFilter,
  setFilter: (filter: StringNotStartsWithFilter) => void
) {
  if (filter.type !== "does_not_start_with") {
    return { builder: null, util: null };
  }

  const builder = (
    <PillInput
      values={filter.values}
      setValues={(values) => setFilter({ ...filter, values })}
      placeholder="Values..."
    />
  );
  const util = null;
  return { builder, util };
}

function useStringEndsWithBuilder(
  filter: StringFilter,
  setFilter: (filter: StringEndsWithFilter) => void
) {
  if (filter.type !== "ends_with") {
    return { builder: null, util: null };
  }

  const builder = (
    <PillInput
      values={filter.values}
      setValues={(values) => setFilter({ ...filter, values })}
      placeholder="Values..."
    />
  );
  const util = null;
  return { builder, util };
}

function useStringNotEndsWithBuilder(
  filter: StringFilter,
  setFilter: (filter: StringNotEndsWithFilter) => void
) {
  if (filter.type !== "does_not_end_with") {
    return { builder: null, util: null };
  }

  const builder = (
    <PillInput
      values={filter.values}
      setValues={(values) => setFilter({ ...filter, values })}
      placeholder="Values..."
    />
  );
  const util = null;
  return { builder, util };
}

function useStringCustomBuilder(
  filter: StringFilter,
  setFilter: (filter: StringCustomFilter) => void
) {
  if (filter.type !== "custom") {
    return { builder: null, util: null };
  }

  const builder = (
    <CodeInput
      value={filter.partial}
      setValue={(partial) => setFilter({ type: "custom", partial })}
      placeholder="!= null"
    />
  );

  const util = null;

  return { builder, util };
}
