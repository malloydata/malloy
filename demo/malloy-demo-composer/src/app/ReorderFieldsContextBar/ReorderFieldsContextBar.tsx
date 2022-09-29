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

import { useEffect, useState } from "react";
import { QuerySummaryItem } from "../../types";
import { ActionIcon, ActionIconName } from "../ActionIcon";
import {
  Button,
  ContextMenuMain,
  RightButtonRow,
  ContextMenuTitle,
  EmptyMessage,
} from "../CommonElements";
import { FieldButton } from "../FieldButton";
import { notUndefined } from "../utils";

interface ReorderFieldsContextBarProps {
  updateFieldOrder: (newOrdering: number[]) => void;
  stageSummary: QuerySummaryItem[];
  onComplete: () => void;
  fieldIndex?: number;
}

export const ReorderFieldsContextBar: React.FC<
  ReorderFieldsContextBarProps
> = ({ updateFieldOrder, stageSummary, onComplete, fieldIndex }) => {
  const [selectedField, setSelectedField] = useState<number | undefined>(
    fieldIndex
  );

  const originalOrdering = stageSummary
    .map((item) => {
      if (
        item.type === "field" ||
        item.type === "field_definition" ||
        item.type === "nested_query_definition"
      ) {
        const kind =
          item.type === "field" || item.type === "field_definition"
            ? item.kind
            : "query";
        const action: ActionIconName =
          kind === "dimension"
            ? "group_by"
            : kind === "measure"
            ? "aggregate"
            : "nest";
        return {
          fieldIndex: item.fieldIndex,
          kind,
          name: item.name,
          action,
        };
      } else {
        return undefined;
      }
    })
    .filter(notUndefined);

  const [currentOrdering, setCurrentOrdering] = useState(originalOrdering);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const currentIndex = currentOrdering.findIndex(
        (item) => item.fieldIndex === selectedField
      );
      const moveOffset =
        event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      const otherIndex = currentIndex + moveOffset;
      if (
        currentIndex > -1 &&
        moveOffset !== 0 &&
        otherIndex >= 0 &&
        otherIndex < currentOrdering.length
      ) {
        const newList = [...currentOrdering];
        const tempItem = newList[currentIndex];
        newList[currentIndex] = newList[otherIndex];
        newList[otherIndex] = tempItem;
        setCurrentOrdering(newList);
      }
    };
    window.addEventListener("keyup", handle);
    return () => window.removeEventListener("keyup", handle);
  });

  return (
    <ContextMenuMain>
      <ContextMenuTitle>Reorder Fields</ContextMenuTitle>
      {currentOrdering.map((item) => {
        const active = selectedField === item.fieldIndex;
        const disableHover = selectedField !== undefined;
        return (
          <FieldButton
            key={item.fieldIndex}
            icon={<ActionIcon action={item.action} />}
            name={item.name}
            color={item.kind}
            onClick={() =>
              setSelectedField(
                fieldIndex || active ? undefined : item.fieldIndex
              )
            }
            active={active}
            disableHover={disableHover}
          />
        );
      })}
      {currentOrdering.length === 0 && (
        <EmptyMessage>Query has no fields.</EmptyMessage>
      )}
      <RightButtonRow>
        <Button
          onClick={() => {
            updateFieldOrder(currentOrdering.map((item) => item.fieldIndex));
            onComplete();
          }}
        >
          Done
        </Button>
      </RightButtonRow>
    </ContextMenuMain>
  );
};
