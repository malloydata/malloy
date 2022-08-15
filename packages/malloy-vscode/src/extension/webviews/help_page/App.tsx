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
import { HelpMessageType } from "../../webview_message_manager";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { useHelpVSCodeContext } from "./help_vscode_context";

export const App: React.FC = () => {
  const [helpKeyword, setHelpKeyword] = useState("");
  const vscode = useHelpVSCodeContext();

  // TODO crs this might only be necessary because the MessageManager makes it necessary
  useEffect(() => {
    vscode.postMessage({ type: HelpMessageType.AppReady });
  });

  useEffect(() => {
    const listener = (event: any) => {
      const message = event.data;
      setHelpKeyword(message.keyword);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  return (
    <ViewDiv>
      {helpKeyword}
      <ButtonLink href="https://looker-open-source.github.io/malloy/">
        View Documentation
      </ButtonLink>
      <ButtonLink href="https://looker-open-source.github.io/malloy/documentation/language/basic.html">
        Quick Start Guide
      </ButtonLink>
      <ButtonLink href="https://looker-open-source.github.io/malloy/aux/generated/samples.zip">
        Download Sample Models
      </ButtonLink>
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
