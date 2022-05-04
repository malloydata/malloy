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
import moment from "moment";
import { useEffect, useState } from "react";
import { COLORS } from "../colors";
import { FormItem, FormInputLabel } from "../CommonElements";

interface DateInputProps {
  value: Date;
  setValue: (value: Date) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  granularity:
    | "year"
    | "month"
    | "day"
    | "quarter"
    | "week"
    | "hour"
    | "minute"
    | "second";
  onFocus?: () => void;
  onBlur?: () => void;
  isActive?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  setValue,
  placeholder,
  label,
  autoFocus,
  granularity,
  onFocus,
  onBlur,
  isActive,
}) => {
  const format =
    granularity === "year"
      ? "YYYY"
      : granularity === "month"
      ? "YYYY-MM"
      : granularity === "quarter"
      ? "YYYY-[Q]Q"
      : granularity === "week"
      ? "[WK]YYYY-MM-DD"
      : granularity === "day"
      ? "YYYY-MM-DD"
      : granularity === "hour"
      ? "YYYY-MM-DD HH:00"
      : granularity === "minute"
      ? "YYYY-MM-DD HH:mm"
      : "YYYY-MM-DD HH:mm:ss";
  const [tempValue, setTempValue] = useState(moment(value).format(format));

  useEffect(() => {
    setTempValue(moment(value).format(format));
  }, [value, format]);

  return (
    <FormItem>
      {label && <FormInputLabel>{label}</FormInputLabel>}
      <StyledInput
        type="text"
        placeholder={placeholder || format}
        value={tempValue}
        onFocus={onFocus}
        onBlur={onBlur}
        isActive={isActive}
        onChange={(event) => {
          const raw = event.target.value;
          setTempValue(raw);
          const regex =
            granularity === "year"
              ? /\d\d\d\d/
              : granularity === "month"
              ? /\d\d-\d\d\d\d/
              : granularity === "quarter"
              ? /\d\d\d\d-Q\d/
              : granularity === "week"
              ? /WK\d\d-\d\d-\d\d\d\d/
              : granularity === "day"
              ? /\d\d-\d\d-\d\d\d\d/
              : granularity === "hour"
              ? /\d\d-\d\d-\d\d\d\d \d\d:00/
              : granularity === "minute"
              ? /\d\d-\d\d-\d\d\d\d \d\d:\d\d/
              : /\d\d-\d\d-\d\d\d\d \d\d:\d\d:\d\d/;
          if (raw.match(regex)) {
            const m = moment(raw, format);
            if (m.isValid()) {
              setValue(m.toDate());
            }
          }
        }}
        autoFocus={autoFocus}
      />
    </FormItem>
  );
};

const StyledInput = styled.input<{
  isActive?: boolean;
}>`
  font-family: Roboto;
  font-size: 14px;
  border-radius: 5px;
  padding: 5.75px 10px;
  outline: none;
  width: calc(100% - 22px);

  ${({ isActive }) => `
    border: 1px solid ${isActive ? COLORS.dimension.fillStrong : "#efefef"};
    background-color: ${isActive ? COLORS.dimension.fillLight : "white"};
    color: ${isActive ? COLORS.dimension.fillStrong : "#505050"};
  `}

  &:focus {
    border-color: #4285f4;
    background-color: ${COLORS.dimension.fillLight};
  }
`;
