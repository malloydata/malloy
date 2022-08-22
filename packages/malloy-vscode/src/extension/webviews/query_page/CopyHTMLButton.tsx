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

import DownloadIcon from "../assets/copy.svg";
import styled from "styled-components";
import { Scroll } from "./Scroll";

interface CopyHTMLButtonProps {
  onClick: () => void;
}

export const CopyHTMLButton: React.FC<CopyHTMLButtonProps> = ({ onClick }) => {
  return <StyledDownloadIcon onClick={onClick} />;
};

const StyledDownloadIcon = styled(DownloadIcon)`
  ${Scroll} & {
    display: none;
  }
  ${Scroll}:hover & {
    display: block;
  }
  width: 25px;
  height: 25px;
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: var(--background);
  border: 1px solid var(--dropdown-border);
  border-radius: 4px;
  cursor: pointer;
  z-index: 1;
`;
