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

import {
  QueryFieldDef,
  SearchValueMapResult,
  StructDef,
} from "@malloydata/malloy";
import { useState } from "react";
import { ActionIcon } from "../ActionIcon";
import { AddNewDimension } from "../AddNewDimension";
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
  isDimension,
  pathParent,
  termsForField,
} from "../utils";

interface GroupByContextBarProps {
  source: StructDef;
  selectField: (fieldPath: string) => void;
  addNewDimension: (dimension: QueryFieldDef) => void;
  onComplete: () => void;
  topValues: SearchValueMapResult[] | undefined;
}

export const GroupByContextBar: React.FC<GroupByContextBarProps> = ({
  source,
  selectField,
  addNewDimension,
  onComplete,
  topValues,
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
                    name="New Dimension"
                    color="other"
                  />
                  <FieldList
                    fields={source.fields}
                    filter={(field) =>
                      field.type !== "turtle" &&
                      field.type !== "struct" &&
                      !field.aggregate
                    }
                    showNested={true}
                    selectField={selectField}
                    topValues={topValues}
                  />
                </>
              )}
              {searchTerm !== "" && (
                <>
                  <SearchList
                    topValues={topValues}
                    searchTerm={searchTerm}
                    items={flatFields(source)
                      .filter(({ field }) => isDimension(field))
                      .map(({ field, path }) => ({
                        item: fieldToSummaryItem(field, path),
                        terms: [...termsForField(field, path), "group_by"],
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
        <AddNewDimension
          addDimension={addNewDimension}
          source={source}
          onComplete={onComplete}
        />
      )}
    </ContextMenuOuter>
  );
};

export function keyFor(path: string): string {
  return "group_by/" + path;
}
