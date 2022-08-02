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

const SimpleErrorMessage = styled.div`
  padding: 5px;
  background-color: #fbb;
  font-family: "Google Sans", sans-serif;
  font-size: 12px;
  color: #4b4c50;
  border-radius: 5px;
`;

const MultiLineErrorMessage = styled(SimpleErrorMessage)`
  white-space: pre-wrap;
  font-family: "Roboto Mono", monospace;
`;

export interface ErrorMessageProps {
  error: Error | null | undefined;
}

export const ErrorMessage = ({
  error,
}: ErrorMessageProps): React.ReactElement | null => {
  if (error) {
    const { message } = error;
    if (message.split("\n").length > 1) {
      return <MultiLineErrorMessage>{message}</MultiLineErrorMessage>;
    } else {
      return <SimpleErrorMessage>{message}</SimpleErrorMessage>;
    }
  }
  return null;
};
