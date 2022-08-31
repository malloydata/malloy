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
import { Title } from "./Title";

export interface ModelViewProps {
  model: string;
  modelPath?: string;
}

export const ModelView: React.FC<ModelViewProps> = ({ model, modelPath }) => {
  return (
    <Wrapper>
      <Title>Model File: {modelPath}</Title>
      <Editor value={model} readOnly={true} />
    </Wrapper>
  );
};

const Wrapper = styled.div`
  display: flex;
  flex: auto;
  flex-direction: column;
  height: 60%;
  width: 100%;
  margin: 5px;
`;
