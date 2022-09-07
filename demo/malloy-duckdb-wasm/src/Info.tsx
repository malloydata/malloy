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

export interface InfoProps {
  title: string;
}

export const Info: React.FC<InfoProps> = ({ title }) => {
  return <Padding title={title}>&#9432;</Padding>;
};

const Padding = styled.span`
  padding-left: 5px;
  cursor: pointer;
`;
