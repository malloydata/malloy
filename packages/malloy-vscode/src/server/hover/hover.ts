import {
  Hover,
  HoverParams,
  MarkupKind,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DocumentHighlight, Malloy } from "@malloydata/malloy";
import { HIGHLIGHT_DOCS } from "../completions/completion_docs";

const highlightForPosition = (
  highlights: DocumentHighlight[],
  { character, line }: Position
) => {
  return highlights.find((highlight) => {
    const { start, end } = highlight.range;
    const afterStart =
      line > start.line ||
      (line === start.line && character >= start.character);
    const beforeEnd =
      line < end.line || (line === end.line && character <= end.character);
    return afterStart && beforeEnd;
  });
};

export const getHover = (
  document: TextDocument,
  params: HoverParams
): Hover | null => {
  const highlight = highlightForPosition(
    Malloy.parse({ source: document.getText() }).highlights,
    params.position
  );

  if (highlight) {
    const value = HIGHLIGHT_DOCS[highlight.type];
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value,
      },
    };
  }
  return null;
};
