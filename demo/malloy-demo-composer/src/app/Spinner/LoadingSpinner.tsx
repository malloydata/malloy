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

import React from "react";
import styled, { keyframes } from "styled-components";
import { ReactComponent as SpinnerSVG } from "../assets/img/spinner.svg";
import { ColorKey, COLORS } from "../colors";

interface LoadingSpinnerProps {
  text: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ text }) => {
  return (
    <VerticalCenter>
      <HorizontalCenter>
        <Label>{text}</Label>
        <Spinner size={25} />
      </HorizontalCenter>
    </VerticalCenter>
  );
};

interface SpinnerProps {
  size: number;
  color?: ColorKey;
}

export const Spinner: React.FC<SpinnerProps> = ({ size, color }) => {
  return (
    <SpinningSVG
      size={size}
      color={color || "dimension"}
      width={size + "px"}
      height={size + "px"}
    />
  );
};

const rotation = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(359deg);
  }
`;

const SpinningSVG = styled(SpinnerSVG)<{ size: number; color: ColorKey }>`
  ${({ size, color }) => `
    width: ${size}px;
    height: ${size}px;

    .primarystroke {
      stroke: ${COLORS[color].fillStrong}
    }
  `}
  animation: ${rotation} 2s infinite linear;
`;

const Label = styled.div`
  margin-bottom: 10px;
  color: #505050;
  font-size: 15px;
`;

const VerticalCenter = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1 0 auto;
  width: 100%;
  height: 100%;
`;

const HorizontalCenter = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;
