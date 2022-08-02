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
import styled from "styled-components";
import { COLORS } from "../colors";
import { ChannelIcon, ChannelIconName } from "../ChannelIcon";

export const ChannelButton: React.FC<{
  icon: ChannelIconName;
  text: string;
  onClick: () => void;
  selected: boolean;
}> = ({ icon, text, onClick, selected }) => {
  return (
    <StyledButton onClick={onClick} selected={selected}>
      <ChannelIcon name={icon} />
      {text}
    </StyledButton>
  );
};

const StyledButton = styled.button<{ selected: boolean }>`
  outline: none;
  border: none;
  color: ${COLORS.dimension.fillStrong};
  display: flex;
  flex-direction: column;
  background-color: transparent;
  gap: 8px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 10px;
  font-weight: 600;

  color: ${COLORS.other.fillStrong};

  &:hover {
    background-color: ${COLORS.other.fillLight};
  }

  .primary-fill {
    fill: ${COLORS.other.fillStrong};
  }

  ${({ selected }) =>
    selected &&
    `
    color: ${COLORS.dimension.fillStrong};

    &:hover {
      background-color: ${COLORS.dimension.fillLight};
    }

    .primary-fill {
      fill: ${COLORS.dimension.fillStrong};
    }
  `}
`;
