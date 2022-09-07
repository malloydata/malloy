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

interface RunProps {
  onRun: () => void;
}

export const Run: React.FC<RunProps> = ({ onRun }) => {
  return <Button onClick={onRun}>Run</Button>;
};

const Button = styled.button`
  margin-left: 5px;
  border: 0;
  background: #4285f4;
  color: #ffffff;
  height: 30px;
  width: 80px;
  border-radius: 3px;
`;
