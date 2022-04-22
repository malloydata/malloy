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

import { SearchValueMapResult } from "@malloydata/malloy";
import styled from "styled-components";
import { QuerySummaryItem, QuerySummaryItemField } from "../../types";
import { EmptyMessage } from "../CommonElements";
import { FieldButton } from "../FieldButton";
import { FieldDetailPanel } from "../FieldDetailPanel";
import { HoverToPopover } from "../HoverToPopover";
import { TypeIcon } from "../TypeIcon";
import { typeOfField } from "../utils";

export interface SearchItem {
  select: () => void;
  item: QuerySummaryItem;
  detail?: string;
  terms: string[];
  key: string;
}

interface SearchListProps {
  searchTerm: string;
  items: SearchItem[];
  topValues: SearchValueMapResult[] | undefined;
}

interface UseSearchListResult {
  searchList: JSX.Element;
  count: number;
}

export const useSearchList = ({
  searchTerm,
  items,
  topValues,
}: SearchListProps): UseSearchListResult => {
  const rankedItems = items
    .map((item) => {
      return { item, rank: rank(item.terms, searchTerm) };
    })
    .filter(({ rank }) => rank > 0)
    .sort(({ rank: rankA }, { rank: rankB }) => rankB - rankA);

  const searchList = (
    <ListDiv>
      {rankedItems.map(({ item }) => {
        if (item.item.type === "field") {
          const field = item.item as QuerySummaryItemField;
          const type = typeOfField(item.item.field);
          return (
            <HoverToPopover
              width={300}
              key={item.key}
              content={() => (
                <FieldButton
                  icon={<TypeIcon type={type} kind={field.kind} />}
                  onClick={item.select}
                  name={field.name}
                  color={field.kind}
                  detail={item.detail}
                />
              )}
              popoverContent={() => (
                <FieldDetailPanel
                  fieldName={field.name}
                  fieldType={typeOfField(field.field)}
                  fieldPath={field.path}
                  topValues={topValues}
                />
              )}
            />
          );
        } else {
          return <div />;
        }
      })}
      {rankedItems.length === 0 && <EmptyMessage>No results</EmptyMessage>}
    </ListDiv>
  );

  return { searchList, count: rankedItems.length };
};

export const SearchList: React.FC<SearchListProps> = (props) => {
  const { searchList } = useSearchList(props);
  return searchList;
};

const ListDiv = styled.div`
  display: flex;
  gap: 2px;
  flex-direction: column;
`;

function rank(terms: string[], searchTerm: string) {
  // TODO maybe search better with varying length thingies
  const searchTerms = searchTerm
    .split(" ")
    .map((st) => st.trim())
    .filter((searchTerm) => searchTerm.length > 0);
  let score = 0;
  for (const searchTerm of searchTerms) {
    for (let termIndex = 0; termIndex < terms.length; termIndex++) {
      const term = terms[termIndex];
      const termWeight = terms.length - termIndex;
      const termWords = term.split("_");
      if (term.toLowerCase().includes(searchTerm.toLowerCase())) {
        score += termWeight;
      }
      if (term.toLowerCase() === searchTerm.toLowerCase()) {
        score += termWeight * 10;
      }
      if (term.toLowerCase().startsWith(searchTerm.toLowerCase())) {
        score += termWeight * 6;
      }
      if (
        termWords.some((termWord) =>
          termWord.toLowerCase().startsWith(searchTerm.toLowerCase())
        )
      ) {
        score += termWeight;
      }
    }
  }
  return score;
}
