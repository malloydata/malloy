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

import React, { useEffect, useRef } from "react";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";

interface DropdownProps {
  value: string;
  setValue: (value: string) => void;
  id?: string;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  setValue,
  id,
  options,
  style,
}) => {
  const onChange = (event: any) => {
    setValue(event.target.value);
  };

  // TODO: This is a hack because the VSCodeDropdown doesn't immediately select
  //       the correct value. It requires a bump to update itself.
  const theElement = useRef<any>(null);
  useEffect(() => {
    if (theElement.current) {
      theElement.current.value = value;
    }
  });

  return (
    <VSCodeDropdown
      value={value}
      onChange={onChange}
      id={id}
      ref={theElement}
      style={style}
    >
      {options.map((option, index) => (
        <VSCodeOption
          key={index}
          value={option.value}
          selected={value === option.value}
        >
          {option.label}
        </VSCodeOption>
      ))}
    </VSCodeDropdown>
  );
};
