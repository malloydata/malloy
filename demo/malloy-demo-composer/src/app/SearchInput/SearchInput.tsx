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

import { KeyboardEvent } from "react";
import styled from "styled-components";
import { ActionIcon } from "../ActionIcon";

interface SearchInputProps {
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onTab?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  setValue,
  placeholder,
  autoFocus,
  onTab,
}) => {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") {
      onTab && onTab();
      event.stopPropagation();
      event.preventDefault();
    }
  };

  return (
    <SearchRow>
      <SearchIcon>
        <ActionIcon action="search" color="other" />
      </SearchIcon>
      <StyledInput
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoFocus={autoFocus}
        tabIndex={1}
        onKeyDown={onKeyDown}
      />
    </SearchRow>
  );
};

const SearchRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
`;

const SearchIcon = styled.div`
  position: fixed;
  left: 15px;
  top: 9px;
  pointer-events: none;
`;

const StyledInput = styled.input`
  font-family: "Roboto Mono";
  font-size: 14px;
  border-radius: 5px;
  border: none;
  padding: 3px 10px 1px 38px;
  outline: none;
  width: calc(100% - 22px);

  &:focus {
    border-color: #4285f4;
  }
`;
