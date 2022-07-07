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
import { FieldDef, SearchValueMapResult } from "@malloydata/malloy";
import { useState } from "react";
import { AddFilter } from "../AddFilter";
import {
  ContextMenuContent,
  ContextMenuSearchHeader,
  EmptyMessage,
  ScrollMain,
} from "../CommonElements";
import { useSearch } from "../data";
import { FieldList } from "../FieldList";
import { SearchInput } from "../SearchInput";
import { useSearchList } from "../SearchList";
import { LoadingSpinner } from "../Spinner";
import {
  fieldToSummaryItem,
  flatFields,
  isDimension,
  termsForField,
} from "../utils";
import { FieldButton } from "../FieldButton";
import { ActionIcon } from "../ActionIcon";
import { compileFilter } from "../../core/compile";

interface FilterContextBarProps {
  source: StructDef;
  addFilter: (filter: FilterExpression, as?: string) => void;
  onComplete: () => void;
  needsRename: boolean;
  topValues: SearchValueMapResult[] | undefined;
  analysisPath: string;
}

export const FilterContextBar: React.FC<FilterContextBarProps> = ({
  source,
  addFilter,
  onComplete,
  needsRename,
  topValues,
  analysisPath,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [field, setField] = useState<{ path: string; def: FieldDef }>();
  const { searchResults, isLoading } = useSearch(
    source,
    analysisPath,
    searchTerm
  );
  const stringSearchResults =
    searchResults &&
    searchResults.filter((r) => r.fieldType === "string").slice(0, 100);

  const searchItems = flatFields(source)
    .filter(({ field }) => isDimension(field))
    .map(({ field, path }) => ({
      item: fieldToSummaryItem(field, path),
      terms: termsForField(field, path),
      key: keyFor(path),
      select: () => setField({ path, def: field }),
    }));

  const { searchList, count: resultCount } = useSearchList({
    searchTerm,
    items: searchItems || [],
    topValues,
  });

  const valueResultCount = stringSearchResults?.length || 0;

  const showFieldResults = resultCount > 0;
  const showValueResults = valueResultCount > 0 || isLoading;

  return (
    <div>
      {!field && (
        <ContextMenuSearchHeader>
          <SearchInput
            placeholder="Search"
            value={searchTerm}
            setValue={setSearchTerm}
            autoFocus={true}
          />
        </ContextMenuSearchHeader>
      )}
      <div>
        {field && (
          <AddFilter
            analysisPath={analysisPath}
            source={source}
            fieldPath={field.path}
            field={field.def}
            addFilter={addFilter}
            onComplete={onComplete}
            needsRename={needsRename}
          />
        )}
        {!field && (
          <>
            {searchTerm === "" && (
              <ScrollMain>
                <ContextMenuContent>
                  <FieldList
                    fields={source.fields}
                    filter={isDimension}
                    showNested={true}
                    selectField={(path, def) => setField({ path, def })}
                    topValues={topValues}
                  />
                </ContextMenuContent>
              </ScrollMain>
            )}
            {searchTerm !== "" && (
              <>
                {showFieldResults && (
                  <ScrollMain
                    style={{
                      borderBottom: showFieldResults ? "1px solid #efefef" : "",
                      maxHeight: showValueResults ? "200px" : "300px",
                    }}
                  >
                    <ContextMenuContent>{searchList}</ContextMenuContent>
                  </ScrollMain>
                )}
                {showValueResults && source && (
                  <ScrollMain
                    style={{
                      borderBottom: "1px solid #efefef",
                      maxHeight: showFieldResults ? "200px" : "300px",
                    }}
                  >
                    <ContextMenuContent>
                      {stringSearchResults &&
                        stringSearchResults.length > 0 &&
                        stringSearchResults.map((searchResult, index) => {
                          return (
                            <FieldButton
                              key={index}
                              name={searchResult.fieldValue}
                              detail={searchResult.fieldName}
                              icon={<ActionIcon action="filter" />}
                              color="filter"
                              onClick={() => {
                                compileFilter(
                                  source,
                                  `${searchResult.fieldName} = '${searchResult.fieldValue}'`
                                ).then((expression) => {
                                  addFilter && addFilter(expression);
                                  onComplete();
                                });
                              }}
                            />
                          );
                        })}
                      {stringSearchResults !== undefined &&
                        stringSearchResults.length === 0 && (
                          <EmptyMessage>No value results</EmptyMessage>
                        )}
                      {isLoading && (
                        <EmptyMessage>
                          <LoadingSpinner text="Loading value results..." />
                        </EmptyMessage>
                      )}
                    </ContextMenuContent>
                  </ScrollMain>
                )}
              </>
            )}
            {!showFieldResults && !showValueResults && (
              <EmptyMessage>No results</EmptyMessage>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export function keyFor(path: string): string {
  return "field/" + path;
}
