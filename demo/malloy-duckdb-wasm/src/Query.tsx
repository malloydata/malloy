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
import { highlight } from "./highlighter";

export interface QueryProps {
  query: string;
}

export const Query: React.FC<QueryProps> = ({ query }) => {
  const [html, setHTML] = useState("");

  useEffect(() => {
    (async () => {
      setHTML(await highlight(query, "malloy"));
    })();
  }, [query]);

  return <Scroll dangerouslySetInnerHTML={{ __html: html }}></Scroll>;
};

export const Scroll = styled.div`
  flex: auto;
  height: 94vh;
  width: 45vw;
  overflow-y: scroll;
  border: 1px inset;
  padding: 5px;
`;
