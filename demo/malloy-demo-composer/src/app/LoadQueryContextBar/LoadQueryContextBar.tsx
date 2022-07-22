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
import {
  ContextMenuContent,
  ContextMenuOuter,
  ContextMenuSearchHeader,
  ScrollMain,
} from "../CommonElements";
import { FieldList } from "../FieldList";
import { SearchInput } from "../SearchInput";
import { SearchList } from "../SearchList";
import {
  fieldToSummaryItem,
  flatFields,
  isQuery,
  pathParent,
  termsForField,
} from "../utils";

interface LoadQueryContextBarProps {
  source: StructDef;
  selectField: (fieldPath: string) => void;
  onComplete: () => void;
}

export const LoadQueryContextBar: React.FC<LoadQueryContextBarProps> = ({
  source,
  selectField,
  onComplete,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  return (
    <ContextMenuOuter>
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
            <FieldList
              fields={source.fields}
              filter={(field) => field.type === "turtle"}
              showNested={true}
              selectField={(fieldPath) => {
                selectField(fieldPath);
                onComplete();
              }}
              topValues={undefined}
            />
          )}
          {searchTerm !== "" && (
            <>
              <SearchList
                topValues={undefined}
                searchTerm={searchTerm}
                items={flatFields(source)
                  .filter(({ field }) => isQuery(field))
                  .map(({ field, path }) => ({
                    item: fieldToSummaryItem(field, path),
                    terms: [...termsForField(field, path), "query"],
                    detail: pathParent(path),
                    key: keyFor(path),
                    select: () => selectField(path),
                  }))}
              />
            </>
          )}
        </ContextMenuContent>
      </ScrollMain>
    </ContextMenuOuter>
  );
};

export function keyFor(path: string): string {
  return "load/" + path;
}
