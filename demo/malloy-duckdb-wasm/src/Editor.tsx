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

import React, { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";
import styled from "styled-components";
import { getMonacoGrammar } from "./utils/monaco";

self.MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string) {
    if (label === "json") {
      return "./dist/json.worker.bundle.js";
    }
    return "./dist/editor.worker.bundle.js";
  },
};

monaco.languages.register({
  id: "malloy",
});

monaco.languages.setMonarchTokensProvider("malloy", getMonacoGrammar());

export interface EditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export const Editor: React.FC<EditorProps> = ({
  value,
  language = "malloy",
  readOnly = false,
  onChange,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  let editor: monaco.editor.IStandaloneCodeEditor;
  useEffect(() => {
    if (divRef.current) {
      editor = monaco.editor.create(divRef.current, {
        automaticLayout: true,
        fontSize: 11,
        fontFamily: "Roboto Mono",
        value,
        language,
        readOnly,
        minimap: {
          enabled: false,
        },
      });
      if (onChange) {
        editor.getModel()?.onDidChangeContent(() => {
          onChange(editor.getValue());
        });
      }
    }

    return () => {
      editor.dispose();
    };
  }, [value, onChange]);

  return <Wrapper className="Editor" ref={divRef} />;
};

const Wrapper = styled.div`
  flex: auto;
  position: relative;
  overflow: hidden;
`;
