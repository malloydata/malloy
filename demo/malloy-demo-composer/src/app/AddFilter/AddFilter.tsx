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

import { FilterExpression, StructDef } from "@malloydata/malloy";
import { useState } from "react";
import { compileFilter } from "../../core/compile";
import { CodeInput } from "../CodeInput";
import {
  Button,
  ContextMenuTitle,
  FieldIcon,
  SmallFieldName,
  FormFieldList,
  RightButtonRow,
  FieldLabel,
  FormInputLabel,
} from "../CommonElements";
import { FieldDef } from "@malloydata/malloy";
import { TypeIcon } from "../TypeIcon";
import { StringFilterBuilder } from "./StringFilterBuilder";
import {
  BooleanFilter,
  NumberFilter,
  StringFilter,
  TimeFilter,
} from "../../types";
import {
  booleanFilterToString,
  numberFilterToString,
  stringFilterToString,
  timeFilterToString,
} from "../../core/filters";
import styled from "styled-components";
import { NumberFilterBuilder } from "./NumberFilterBuilder";
import { TimeFilterBuilder } from "./TimeFilterBuilder";
import { BooleanFilterBuilder } from "./BooleanFilterBuilder";

interface AddFilterProps {
  source: StructDef;
  field: FieldDef;
  fieldPath: string;
  addFilter: (filter: FilterExpression, as?: string) => void;
  needsRename: boolean;
  onComplete: () => void;
}

export const AddFilter: React.FC<AddFilterProps> = ({
  source,
  field,
  addFilter,
  needsRename,
  onComplete,
  fieldPath,
}) => {
  const type =
    field.type === "struct"
      ? "source"
      : field.type === "turtle"
      ? "query"
      : field.type;
  const kind =
    field.type === "struct"
      ? "source"
      : field.type === "turtle"
      ? "query"
      : field.aggregate
      ? "measure"
      : "dimension";
  const [stringFilter, setStringFilter] = useState<StringFilter>({
    type: "is_equal_to",
    values: [],
  });
  const [numberFilter, setNumberFilter] = useState<NumberFilter>({
    type: "is_equal_to",
    values: [],
  });
  const [timeFilter, setTimeFilter] = useState<TimeFilter>({
    type: "is_on",
    date: new Date(),
    granularity: "day",
  });
  const [booleanFilter, setBooleanFilter] = useState<BooleanFilter>({
    type: "is_true",
  });
  const [filter, setFilter] = useState(
    type === "string"
      ? stringFilterToString(fieldPath, stringFilter)
      : type === "number"
      ? numberFilterToString(fieldPath, numberFilter)
      : type === "date" || type === "timestamp"
      ? timeFilterToString(fieldPath, timeFilter)
      : type === "boolean"
      ? booleanFilterToString(fieldPath, booleanFilter)
      : ""
  );
  const [newName, setNewName] = useState("");

  return (
    <div>
      <form>
        <ContextMenuTitle style={{ padding: "15px", paddingBottom: 0 }}>
          Filter
          <FieldLabel>
            <FieldIcon color="dimension">
              <TypeIcon type={type} kind={kind}></TypeIcon>
            </FieldIcon>
            <SmallFieldName>{field.name}</SmallFieldName>
          </FieldLabel>
        </ContextMenuTitle>
        {needsRename && (
          <RenameBox>
            <FormFieldList>
              <CodeInput
                value={newName}
                setValue={setNewName}
                placeholder="field name"
                label="Field Name"
                autoFocus={true}
              />
              <FormInputLabel>Filter</FormInputLabel>
            </FormFieldList>
          </RenameBox>
        )}
        {type === "string" && (
          <StringFilterBuilder
            source={source}
            fieldPath={fieldPath}
            filter={stringFilter}
            setFilter={(f) => {
              setStringFilter(f);
              setFilter(stringFilterToString(fieldPath, f));
            }}
          />
        )}
        {type === "boolean" && (
          <BooleanFilterBuilder
            filter={booleanFilter}
            setFilter={(f) => {
              setBooleanFilter(f);
              setFilter(booleanFilterToString(fieldPath, f));
            }}
          />
        )}
        {type === "number" && (
          <NumberFilterBuilder
            filter={numberFilter}
            setFilter={(f) => {
              setNumberFilter(f);
              setFilter(numberFilterToString(fieldPath, f));
            }}
          />
        )}
        {(type === "date" || type === "timestamp") && (
          <TimeFilterBuilder
            type={type}
            filter={timeFilter}
            setFilter={(f) => {
              setTimeFilter(f);
              setFilter(timeFilterToString(fieldPath, f));
            }}
          />
        )}
        <RightButtonRow style={{ padding: "0 15px 15px 15px" }}>
          <Button
            type="submit"
            onClick={(event) => {
              compileFilter(source, filter)
                .then((filterExpression) => {
                  addFilter(filterExpression, newName || undefined);
                  onComplete();
                })
                // eslint-disable-next-line no-console
                .catch(console.log);
              event.stopPropagation();
              event.preventDefault();
            }}
          >
            Done
          </Button>
        </RightButtonRow>
      </form>
    </div>
  );
};

const RenameBox = styled.div`
  margin: 15px;
  margin-top: 0;
  margin-bottom: 10px;
`;
