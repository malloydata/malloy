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

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import Markdown from "markdown-to-jsx";

import { HelpMessageType } from "../../message_types";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { useHelpVSCodeContext } from "./help_vscode_context";
import { HIGHLIGHT_DOCS } from "../../../server/completions/completion_docs";

export const App: React.FC = () => {
  const [help, setHelp] = useState("");
  const vscode = useHelpVSCodeContext();

  // TODO crs this might only be necessary because the MessageManager makes it necessary
  useEffect(() => {
    vscode.postMessage({ type: HelpMessageType.AppReady });
  });

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const { keyword } = event.data;
      if (HIGHLIGHT_DOCS[keyword]) {
        setHelp(HIGHLIGHT_DOCS[keyword]);
      } else {
        setHelp("");
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  return (
    <ViewDiv>
      <ButtonLink href="https://looker-open-source.github.io/malloy/">
        View Documentation
      </ButtonLink>
      <ButtonLink href="https://looker-open-source.github.io/malloy/documentation/language/basic.html">
        Quick Start Guide
      </ButtonLink>
      <ButtonLink href="https://looker-open-source.github.io/malloy/aux/generated/samples.zip">
        Download Sample Models
      </ButtonLink>
      <Help>
        <h3>Quick Help</h3>
        {help && <Markdown>{help}</Markdown>}
        {!help && <span>Select a keyword for quick help.</span>}
      </Help>
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
  align-items: center;
  gap: 20px;
`;

const Help = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
