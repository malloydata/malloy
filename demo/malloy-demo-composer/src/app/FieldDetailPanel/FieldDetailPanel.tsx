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
import { ContextMenuMain, ScrollMain } from "../CommonElements";
import { largeNumberLabel } from "../utils";

interface FieldDetailPanelProps {
  fieldPath?: string;
  filterExpression?: string;
  definition?: string;
  topValues: SearchValueMapResult[] | undefined;
}

export const FieldDetailPanel: React.FC<FieldDetailPanelProps> = ({
  fieldPath,
  topValues,
  filterExpression,
  definition,
}) => {
  const fieldTopValues = topValues?.find(
    (entry) => entry.fieldName === fieldPath
  );
  return (
    <ScrollMain>
      <ContextMenuDetail>
        <InfoDiv>
          {fieldPath && (
            <InfoSection>
              <div>Path</div>
              <FieldPath>
                {fieldPath.length <= 32 ? (
                  fieldPath
                ) : (
                  <NestingFieldName path={fieldPath.split(".")} />
                )}
              </FieldPath>
            </InfoSection>
          )}
          {definition && (
            <InfoSection>
              <div>Definition</div>
              <FieldPath>{definition}</FieldPath>
            </InfoSection>
          )}
          {filterExpression && (
            <InfoSection>
              <div>Filter</div>
              <FieldPath>{filterExpression}</FieldPath>
            </InfoSection>
          )}
          {fieldTopValues && (
            <InfoSection>
              <div>Top Values</div>
              {fieldTopValues.values.slice(0, 8).map((value) => (
                <TopValuesRow key={value.fieldValue}>
                  <TopValuesValue>
                    <TopValuesWeightInner>
                      {value.fieldValue === null ? (
                        <NullSymbol>∅</NullSymbol>
                      ) : (
                        value.fieldValue
                      )}
                    </TopValuesWeightInner>
                  </TopValuesValue>

                  <TopValuesWeight>
                    {largeNumberLabel(value.weight)}
                  </TopValuesWeight>
                </TopValuesRow>
              ))}
            </InfoSection>
          )}
        </InfoDiv>
      </ContextMenuDetail>
    </ScrollMain>
  );
};

const ContextMenuDetail = styled(ContextMenuMain)`
  padding: 20px;
  background-color: rgb(248, 248, 248);
`;

const NullSymbol = styled.span``;

const FieldPath = styled.div`
  color: #505050;
  font-weight: normal;
  font-family: Roboto Mono;
  font-weight: normal;
  font-size: 14px;
  text-transform: none;
  overflow-wrap: break-word;
  padding: 4px 0px;
`;

const InfoDiv = styled.div`
  display: flex;
  gap: 15px;
  flex-direction: column;
`;

const InfoSection = styled.div`
  display: flex;
  gap: 2px;
  flex-direction: column;
`;

const NestingFieldName: React.FC<{ path: string[]; top?: boolean }> = ({
  path,
  top = true,
}) => {
  return (
    <div>
      {top ? "" : "."}
      {path[0]}
      {path.length > 1 && (
        <FieldNameNest>
          <NestingFieldName path={path.slice(1)} top={false} />
        </FieldNameNest>
      )}
    </div>
  );
};

const FieldNameNest = styled.div`
  margin-left: 10px;
`;

export const TopValuesValue = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-start;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #505050;
`;

export const TopValuesWeight = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  align-items: center;
  overflow: hidden;
  flex-shrink: 0;
  color: #9aa0a6;
`;

export const TopValuesWeightInner = styled.div`
  text-overflow: ellipsis;
  text-transform: none;
  color: #505050;
  overflow: hidden;
  white-space: nowrap;
`;

export const TopValuesRow = styled.div`
  border: none;
  background-color: transparent;
  border-radius: 50px;
  padding: 4px 0px;
  text-align: left;
  display: flex;
  color: #353535;
  user-select: none;
  font-size: 14px;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  font-family: "Roboto"
  font-weight: normal;;
`;
