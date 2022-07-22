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
import { FormInputLabel } from "../CommonElements";

interface TimeInputProps {
  value: Date;
  setValue: (value: Date) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  granularity: "hour" | "minute" | "second";
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  setValue,
  placeholder,
  label,
  autoFocus,
  granularity,
}) => {
  const format =
    granularity === "hour"
      ? "HH:00"
      : granularity === "minute"
      ? "HH:mm"
      : "HH:mm:ss";
  const [tempValue, setTempValue] = useState(moment(value).format(format));

  useEffect(() => {
    setTempValue(moment(value).format(format));
  }, [value, format]);

  return (
    <>
      {label && <FormInputLabel>{label}</FormInputLabel>}
      <StyledInput
        type="text"
        placeholder={placeholder || format}
        value={tempValue}
        onChange={(event) => {
          const raw = event.target.value;
          setTempValue(raw);
          const regex =
            granularity === "hour"
              ? /\d\d:00/
              : granularity === "minute"
              ? /\d\d:\d\d/
              : /\d\d:\d\d:\d\d/;
          if (raw.match(regex)) {
            const m = moment(raw, format);
            if (m.isValid()) {
              setValue(
                moment(value)
                  .hour(m.hour())
                  .minute(m.minute())
                  .second(m.second())
                  .toDate()
              );
            }
          }
        }}
        autoFocus={autoFocus}
      />
    </>
  );
};

const StyledInput = styled.input`
  font-family: "Roboto Mono";
  font-size: 14px;
  border-radius: 5px;
  border: 1px solid #efefef;
  padding: 5px 10px;
  outline: none;
  width: calc(100% - 22px);

  &:focus {
    border-color: #4285f4;
  }
`;

export const InputLabel = styled.label`
  font-size: 12px;
  color: #505050;
  font-family: Roboto;
  font-family: Roboto;
  text-transform: none;
`;
