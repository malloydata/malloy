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

import styled from "styled-components";
import { useEffect, useState } from "react";
import { COLORS } from "../colors";
import { FormItem, FormInputLabel } from "../CommonElements";

interface NumberInputProps {
  value: number;
  setValue: (value: number) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  setValue,
  placeholder,
  label,
  autoFocus,
}) => {
  const [tempValue, setTempValue] = useState(value.toString());

  useEffect(() => {
    setTempValue(value.toString());
  }, [value]);

  return (
    <FormItem>
      {label && <FormInputLabel>{label}</FormInputLabel>}
      <StyledInput
        type="number"
        placeholder={placeholder}
        value={tempValue}
        size={1}
        onChange={(event) => {
          const raw = event.target.value;
          setTempValue(raw);
          const v = parseFloat(raw);
          if (!Number.isNaN(v)) {
            setValue(v);
          }
        }}
        autoFocus={autoFocus}
      />
    </FormItem>
  );
};

const StyledInput = styled.input`
  font-family: Roboto;
  font-size: 14px;
  border-radius: 5px;
  border: 1px solid #efefef;
  padding: 5.75px 10px;
  outline: none;
  width: calc(100% - 22px);

  &:focus {
    border-color: #4285f4;
    background-color: ${COLORS.dimension.fillLight};
  }
`;
