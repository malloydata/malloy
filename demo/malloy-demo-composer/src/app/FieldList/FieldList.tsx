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

import { FieldDef, SearchValueMapResult, StructDef } from "@malloydata/malloy";
import { useState } from "react";
import styled from "styled-components";
import { ActionIcon } from "../ActionIcon";
import { FieldButton } from "../FieldButton";
import { FieldDetailPanel } from "../FieldDetailPanel";
import { HoverToPopover } from "../HoverToPopover";
import { ListNest } from "../ListNest";
import { TypeIcon } from "../TypeIcon";
import { typeOfField } from "../utils";

interface FieldListProps {
  path?: string[];
  fields: FieldDef[];
  filter: (field: FieldDef) => boolean;
  showNested: boolean;
  selectField: (fieldPath: string, field: FieldDef) => void;
  topValues: SearchValueMapResult[] | undefined;
}

export const FieldList: React.FC<FieldListProps> = ({
  fields,
  selectField,
  filter,
  showNested,
  path = [],
  topValues,
}) => {
  return (
    <ListDiv>
      {fields
        .filter(
          (field) => filter(field) || (showNested && field.type === "struct")
        )
        .map((field) => {
          if (filter(field)) {
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
            const fieldPath = [...path, field.as || field.name].join(".");
            return (
              <HoverToPopover
                width={300}
                key={field.as || field.name}
                content={() => (
                  <FieldButton
                    icon={<TypeIcon type={type} kind={kind} />}
                    onClick={() => selectField(fieldPath, field)}
                    name={field.as || field.name}
                    color={kind}
                  />
                )}
                popoverContent={() => {
                  return (
                    <FieldDetailPanel
                      fieldName={field.as || field.name}
                      fieldType={typeOfField(field)}
                      fieldPath={fieldPath}
                      topValues={topValues}
                    />
                  );
                }}
              />
            );
          } else if (field.type === "struct" && sourceHasAny(field, filter)) {
            return (
              <CollapsibleSource
                key={field.as || field.name}
                source={field}
                filter={filter}
                selectField={selectField}
                path={[...path, field.as || field.name]}
                topValues={topValues}
              />
            );
          } else {
            return null;
          }
        })}
    </ListDiv>
  );
};

const ListDiv = styled.div`
  display: flex;
  gap: 2px;
  flex-direction: column;
`;

function sourceHasAny(
  source: StructDef,
  filter: (field: FieldDef) => boolean
): boolean {
  return (
    source.fields.some(filter) ||
    source.fields.some(
      (field) => field.type === "struct" && sourceHasAny(field, filter)
    )
  );
}

interface CollapsibleSourceProps {
  path: string[];
  source: StructDef;
  filter: (field: FieldDef) => boolean;
  selectField: (fieldPath: string, field: FieldDef) => void;
  topValues: SearchValueMapResult[] | undefined;
}

const CollapsibleSource: React.FC<CollapsibleSourceProps> = ({
  source,
  filter,
  selectField,
  path,
  topValues,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <FieldButton
        icon={
          <ActionIcon
            action={open ? "container-open" : "container-closed"}
            color="other"
          />
        }
        onClick={() => setOpen(!open)}
        name={source.as || source.name}
        color="other"
      />
      {open && (
        <ListNest>
          <FieldList
            filter={filter}
            selectField={selectField}
            fields={source.fields}
            showNested={true}
            path={path}
            topValues={topValues}
          />
        </ListNest>
      )}
    </div>
  );
};
