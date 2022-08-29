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

import React, { useState } from "react";
import styled from "styled-components";
import { QueryDownloadOptions } from "../../message_types";
import { Dropdown, TextField, VSCodeButton } from "../components";

interface DownloadFormProps {
  onDownload: (options: QueryDownloadOptions) => Promise<void>;
}

export const DownloadForm: React.FC<DownloadFormProps> = ({ onDownload }) => {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [rowLimit, setRowLimit] = useState(1000);
  const [amount, setAmount] = useState<"current" | "all" | number>("current");
  return (
    <Form>
      <FormRow>
        <Dropdown
          value={format}
          setValue={(newValue) => setFormat(newValue as "json" | "csv")}
          options={[
            { value: "json", label: "JSON" },
            { value: "csv", label: "CSV" },
          ]}
          style={{ width: "100%" }}
        />
      </FormRow>
      <FormRow>
        <Dropdown
          value={typeof amount === "number" ? "rows" : amount}
          setValue={(newValue) => {
            if (newValue === "current" || newValue === "all") {
              setAmount(newValue);
            } else {
              setAmount(rowLimit);
            }
          }}
          options={[
            { value: "current", label: "Current result set" },
            { value: "all", label: "All results" },
            { value: "rows", label: "Limited rows" },
          ]}
          style={{ width: "100%" }}
        />
      </FormRow>
      {typeof amount === "number" && (
        <FormRow>
          <TextField
            value={rowLimit.toString()}
            setValue={(newValue) => {
              const parsed = parseInt(newValue);
              if (!Number.isNaN(parsed)) {
                setRowLimit(parsed);
                setAmount(parsed);
              }
            }}
            style={{ width: "100%" }}
          />
        </FormRow>
      )}
      <FormRow>
        <VSCodeButton onClick={() => onDownload({ format, amount })}>
          Download
        </VSCodeButton>
      </FormRow>
    </Form>
  );
};

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FormRow = styled.div`
  display: flex;
`;
