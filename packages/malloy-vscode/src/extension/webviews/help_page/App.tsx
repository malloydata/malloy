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

import React, { useState } from "react";
import styled from "styled-components";
import { HelpMessageType } from "../../webview_message_manager";
import {
  VSCodeButton,
  VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import { useHelpVSCodeContext } from "./help_vscode_context";

export const App: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const vscode = useHelpVSCodeContext();

  const queryURL = `https://looker-open-source.github.io/malloy/search?${new URLSearchParams(
    { query: searchText }
  ).toString()}`;

  const openEditConnections = () => {
    vscode.postMessage({ type: HelpMessageType.EditConnections });
  };

  return (
    <ViewDiv>
      <Row>
        <VSCodeTextField
          value={searchText}
          onChange={(event) => {
            setSearchText((event.target as any).value);
          }}
          placeholder="Search Documentation"
          id="search-input"
          name="query"
          style={{ width: "100%", maxWidth: "195px" }}
        />
        <ButtonLink href={queryURL} small={true}>
          Search
        </ButtonLink>
      </Row>
      <Row>
        <ButtonLink href="https://looker-open-source.github.io/malloy/">
          View Documentation
        </ButtonLink>
      </Row>
      <Row>
        <ButtonLink href="https://looker-open-source.github.io/malloy/documentation/language/basic.html">
          Quick Start Guide
        </ButtonLink>
      </Row>
      <Row>
        <ButtonLink href="https://looker-open-source.github.io/malloy/aux/generated/samples.zip">
          Download Sample Models
        </ButtonLink>
      </Row>
      <Row>
        <VSCodeButton
          style={{ height: "26px", width: "100%", maxWidth: "300px" }}
          onClick={openEditConnections}
        >
          Edit Connections
        </VSCodeButton>
      </Row>
    </ViewDiv>
  );
};

const ButtonLink: React.FC<{ href: string; small?: boolean }> = ({
  href,
  children,
  small = false,
}) => {
  return (
    <a
      href={href}
      style={{
        textDecoration: "none",
        width: small ? "100px" : "100%",
        maxWidth: "300px",
      }}
    >
      <VSCodeButton
        style={{ height: "26px", width: "100%", maxWidth: "300px" }}
      >
        {children}
      </VSCodeButton>
    </a>
  );
};

const ViewDiv = styled.div`
  padding: 1em 20px 1em;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;

  // TODO make the elements move to the left when the panel becomes "wide", to match the default list views
`;
