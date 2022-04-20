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

import { QueryFieldDef, StructDef } from "@malloydata/malloy";
import { useState } from "react";
import { ActionIcon } from "../ActionIcon";
import { AddNewMeasure } from "../AddNewMeasure";
import {
  ContextMenuContent,
  ContextMenuOuter,
  ContextMenuSearchHeader,
  ScrollMain,
} from "../CommonElements";
import { FieldButton } from "../FieldButton";
import { FieldList } from "../FieldList";
import { SearchInput } from "../SearchInput";
import { SearchList } from "../SearchList";
import {
  fieldToSummaryItem,
  flatFields,
  isAggregate,
  pathParent,
  termsForField,
} from "../utils";

interface AggregateContextBarProps {
  source: StructDef;
  selectField: (fieldPath: string) => void;
  addNewMeasure: (measure: QueryFieldDef) => void;
  onComplete: () => void;
}

export const AggregateContextBar: React.FC<AggregateContextBarProps> = ({
  source,
  selectField,
  addNewMeasure,
  onComplete,
}) => {
  const [isAddingNewField, setIsAddingNewField] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  return (
    <ContextMenuOuter>
      {!isAddingNewField && (
        <>
          <ContextMenuSearchHeader>
            <SearchInput
              placeholder="Search"
              value={searchTerm}
              setValue={setSearchTerm}
              autoFocus={true}
            />
          </ContextMenuSearchHeader>
          <ScrollMain>
            <ContextMenuContent>
              {searchTerm === "" && (
                <>
                  <FieldButton
                    icon={<ActionIcon action="add" />}
                    onClick={() => setIsAddingNewField(true)}
                    name="New Measure"
                    color="other"
                  />
                  <FieldList
                    fields={source.fields}
                    filter={isAggregate}
                    showNested={true}
                    selectField={selectField}
                    topValues={undefined}
                  />
                </>
              )}
              {searchTerm !== "" && (
                <>
                  <SearchList
                    topValues={undefined}
                    searchTerm={searchTerm}
                    items={flatFields(source)
                      .filter(({ field }) => isAggregate(field))
                      .map(({ field, path }) => ({
                        item: fieldToSummaryItem(field, path),
                        terms: [...termsForField(field, path), "aggregate"],
                        detail: pathParent(path),
                        key: keyFor(path),
                        select: () => selectField(path),
                      }))}
                  />
                </>
              )}
            </ContextMenuContent>
          </ScrollMain>
        </>
      )}
      {isAddingNewField && (
        <AddNewMeasure
          addMeasure={addNewMeasure}
          source={source}
          onComplete={onComplete}
        />
      )}
    </ContextMenuOuter>
  );
};

export function keyFor(path: string): string {
  return "aggregate/" + path;
}
