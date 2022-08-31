/*
 * Copyright 2022 Google LLC
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

import React from "react";
import styled from "styled-components";
import { Editor } from "./Editor";

export interface QueryProps {
  queryPath?: string;
  query: string;
  onChange: (query: string) => void;
}

export const Query: React.FC<QueryProps> = ({ onChange, query, queryPath }) => {
  return (
    <Wrapper>
      <Title>Query File: {queryPath}</Title>
      <Editor value={query} onChange={onChange} />
    </Wrapper>
  );
};

const Title = styled.div`
  font-size: 14px;
  font-weight: bold;
  padding: 5px;
`;

const Wrapper = styled.div`
  display: flex;
  flex: auto;
  flex-direction: column;
  height: 40%;
  width: 100%;
  margin: 5px;
`;
