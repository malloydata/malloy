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

import { TextFieldType } from "@vscode/webview-ui-toolkit";
import React from "react";
import { VSCodeTextField } from "./fast";

interface TextFieldProps {
  value: string;
  type?: TextFieldType;
  setValue: (value: string) => void;
  placeholder?: string;
  id?: string;
  style?: React.CSSProperties;
}

export const TextField: React.FC<TextFieldProps> = ({
  value,
  setValue,
  type,
  placeholder,
  id,
  style,
}) => {
  const onChange = (event: any) => {
    setValue(event.target.value);
  };

  return (
    <VSCodeTextField
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      id={id}
      style={style}
    />
  );
};
