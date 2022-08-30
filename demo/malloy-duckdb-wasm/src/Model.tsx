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

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { highlight } from "./utils/highlighter";

export interface ModelProps {
  model: string;
}

export const Model: React.FC<ModelProps> = ({ model }) => {
  const [html, setHTML] = useState("");

  useEffect(() => {
    (async () => {
      setHTML(await highlight(model, "malloy"));
    })();
  }, [model]);

  return <Scroll dangerouslySetInnerHTML={{ __html: html }}></Scroll>;
};

export const Scroll = styled.div`
  flex: auto;
  height: 100%;
  width: 50%;
  overflow-y: scroll;
  border: 1px inset;
  padding: 5px;
`;
