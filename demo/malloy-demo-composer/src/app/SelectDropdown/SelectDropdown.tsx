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

import { useState, useRef } from "react";
import styled from "styled-components";
import { useClickOutside } from "../hooks";
import { Popover } from "../Popover";
import { ReactComponent as ChevronDown } from "../assets/img/chevrons/chevron_down.svg";
import { ReactComponent as Checkmark } from "../assets/img/checkmark.svg";
import { COLORS } from "../colors";

interface SelectDropdownProps<T> {
  value: T | undefined;
  placeholder?: string;
  onChange?: (newValue: T) => void;
  options: { label: string; value: T }[];
  disabled?: boolean;
  valueEqual?: (a: T, b: T) => boolean;
}

const Wrapper = styled.div`
  position: relative;
`;

export const InputBox = styled.div`
  font-size: 14px;
  border: 1px solid #efefef;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
  color: #5f6368;
  display: flex;
  justify-content: space-between;
  text-transform: none;
  align-items: center;
  font-family: Arial;
  &:hover {
    border: 1px solid #ececed;
  }
  :focus {
    border-box: none;
    box-shadow: none;
    border: 1px solid #ececed;
    outline: none;
  }
  &[disabled] {
    cursor: default;
    background-color: #f6f6f6;
  }
`;

const OptionDiv = styled.label`
  padding: 0px 10px;
  height: 30px;
  cursor: pointer;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  color: #5f6368;
  display: flex;
  align-items: center;
  &:hover {
    background-color: ${COLORS.dimension.fillLight};
  }
`;

const OptionSpan = styled.span`
  margin-left: 8px;
`;

const CheckIcon = styled(Checkmark)`
  vertical-align: text-top;
  width: 20px;
  opacity: 70%;
  visibility: hidden;

  &.selected {
    visibility: visible;
  }
`;

export const SelectDropdown = <T,>({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled = false,
  valueEqual = (a: T, b: T) => a === b,
}: SelectDropdownProps<T>): JSX.Element => {
  const [open, setOpen] = useState(false);
  const wrapperElement = useRef<HTMLDivElement>(null);
  const label =
    (value !== undefined &&
      options.find((option) => valueEqual(option.value, value))?.label) ||
    placeholder;

  const select = (value: T) => {
    onChange && onChange(value);
    setOpen(false);
  };

  useClickOutside(wrapperElement, () => {
    setOpen(false);
  });

  return (
    <Wrapper ref={wrapperElement}>
      <InputBox tabIndex={0} onClick={() => !disabled && setOpen(true)}>
        {label}
        <ChevronDown width="22px" height="22px" />
      </InputBox>
      <Popover
        open={open}
        setOpen={setOpen}
        placement="bottom-start"
        width={200}
        maxHeight={500}
      >
        <SelectList
          options={options}
          value={value}
          valueEqual={valueEqual}
          onChange={select}
        />
      </Popover>
    </Wrapper>
  );
};

interface SelectListProps<T> {
  value: T | undefined;
  options: { label: string; value: T }[];
  valueEqual?: (a: T, b: T) => boolean;
  onChange: (value: T) => void;
}

export function SelectList<T>({
  options,
  value,
  onChange,
  valueEqual = (a: T, b: T) => a === b,
}: SelectListProps<T>): JSX.Element {
  return (
    <SelectListDiv>
      {options.map((option, index) => {
        const isSelected =
          value !== undefined && valueEqual(value, option.value);
        return (
          <OptionDiv
            key={index}
            onClick={() => onChange(option.value)}
            className={isSelected ? "selected" : ""}
          >
            <OptionRadio type="radio" defaultChecked={isSelected} />
            <CheckIcon className={isSelected ? "selected" : ""} />
            <OptionSpan>{option.label}</OptionSpan>
          </OptionDiv>
        );
      })}
    </SelectListDiv>
  );
}

interface DropdownMenuProps {
  options: { label: string; onSelect: () => void }[];
}

export function DropdownMenu({ options }: DropdownMenuProps): JSX.Element {
  return (
    <SelectListDiv>
      {options.map((option, index) => (
        <OptionDiv key={index} onClick={() => option.onSelect()}>
          <OptionSpan>{option.label}</OptionSpan>
        </OptionDiv>
      ))}
    </SelectListDiv>
  );
}

const OptionRadio = styled.input`
  width: 0;
  height: 0;
`;

const SelectListDiv = styled.div`
  font-size: 14px;
  font-family: Roboto;
  text-transform: none;
  font-weight: normal;
  width: 100%;
  padding: 10px 0;
  overflow-y: auto;
  max-height: 400px;
`;
