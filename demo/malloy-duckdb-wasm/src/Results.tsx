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

import React, { useEffect, useRef } from "react";
import styled from "styled-components";

export interface RenderProps {
  rendered: HTMLElement | undefined;
}

export const Results: React.FC<RenderProps> = ({ rendered }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = ref.current;
    if (parent && rendered) {
      parent.innerHTML = "";
      parent.appendChild(rendered);
    }
  }, [rendered]);

  return (
    <Wrapper>
      <Title>Results:</Title>
      <Render ref={ref}></Render>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin: 5px;
  height: calc(100% - 10px);
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: bold;
  padding: 5px;
`;

const Render = styled.div`
  flex: auto;
  width: 100%;
  overflow-y: scroll;
  border: 1px inset;
  background: #ffffff;
`;
