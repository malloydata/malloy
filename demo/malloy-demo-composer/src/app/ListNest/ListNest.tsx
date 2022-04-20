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

import styled from "styled-components";

export const ListNest: React.FC = ({ children }) => {
  return (
    <NestDiv>
      <NestBar />
      <NestIndented>{children}</NestIndented>
    </NestDiv>
  );
};

const NestDiv = styled.div`
  margin-top: 5px;
  display: flex;
  flex-direction: row;
  gap: 2px;
  margin-left: 13px;
`;

const NestBar = styled.div`
  width: 6px;
  min-width: 6px;
  padding: 5px 0px;
  margin: 0 1px;
  background-color: #efefef;
  border-radius: 100px;
`;

const NestIndented = styled.div`
  width: calc(100% - 10px);
`;
