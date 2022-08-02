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

import { useEffect, useState } from "react";
import styled from "styled-components";
import { Markdown, parseMarkdown } from "../../core/markdown";
import { COLORS } from "../colors";
import { openInBrowser } from "../data";
import { DOMElement } from "../DOMElement";
import { highlightPre } from "../utils";

interface MarkdownDocumentProps {
  content: string;
  loadQueryLink: (
    modelPath: string,
    sourceName: string,
    queryName: string
  ) => void;
}

export const MarkdownDocument: React.FC<MarkdownDocumentProps> = ({
  content,
  loadQueryLink,
}) => {
  const markdown = parseMarkdown(content);

  return <MarkdownNode node={markdown} loadQueryLink={loadQueryLink} />;
};

export const MarkdownNode: React.FC<{
  node: Markdown;
  loadQueryLink: (
    modelPath: string,
    sourceName: string,
    queryName: string
  ) => void;
}> = ({ node, loadQueryLink }) => {
  const children = (node: { children: Markdown[] }) => (
    <MarkdownNodes nodes={node.children} loadQueryLink={loadQueryLink} />
  );
  switch (node.type) {
    case "root":
      return <MarkdownDocumentRoot>{children(node)}</MarkdownDocumentRoot>;
    case "heading":
      switch (node.depth) {
        case 1:
          return <MarkdownHeading1>{children(node)}</MarkdownHeading1>;
        case 2:
          return <MarkdownHeading2>{children(node)}</MarkdownHeading2>;
        case 3:
          return <MarkdownHeading3>{children(node)}</MarkdownHeading3>;
        case 4:
          return <MarkdownHeading4>{children(node)}</MarkdownHeading4>;
        case 5:
          return <MarkdownHeading5>{children(node)}</MarkdownHeading5>;
        case 6:
          return <MarkdownHeading6>{children(node)}</MarkdownHeading6>;
      }
      return <div />;
    case "text":
      return <span>{node.value}</span>;
    case "strong":
      return <b>{children(node)}</b>;
    case "paragraph":
      return <MarkdownParagraph>{children(node)}</MarkdownParagraph>;
    case "link":
      return (
        <MarkdownLink href={node.url} onClick={() => openInBrowser(node.url)}>
          {children(node)}
          {node.title}
        </MarkdownLink>
      );
    case "emphasis":
      return <i>{children(node)}</i>;
    case "blockquote":
      return <blockquote>{children(node)}</blockquote>;
    case "break":
      return <br />;
    case "code":
      return <MarkdownCodeBlock code={node.value} language={node.lang} />;
    case "delete":
      return <del>{children(node)}</del>;
    case "html":
      return <div />;
    case "image":
      return (
        <img src={node.url} alt={node.alt} title={node.title ?? undefined} />
      );
    case "inlineCode":
      return <code>{node.value}</code>;
    case "listItem":
      return <li>{children(node)}</li>;
    case "list":
      return <ul>{children(node)}</ul>;
    case "table":
      return <table>{children(node)}</table>;
    case "tableRow":
      return <tr>{children(node)}</tr>;
    case "tableCell":
      return <td>{children(node)}</td>;
    case "thematicBreak":
      return <hr />;
    case "textDirective":
      switch (node.name) {
        case "malloy-query":
          return (
            <MarkdownLink
              href="#"
              onClick={() => {
                loadQueryLink(
                  node.attributes?.model || "",
                  node.attributes?.source || "",
                  node.attributes?.query || ""
                );
              }}
            >
              <code>{node.attributes?.query}</code>
            </MarkdownLink>
          );
        default:
          return <></>;
      }
    case "leafDirective":
    case "containerDirective":
      return <></>;
  }
};

export const MarkdownNodes: React.FC<{
  nodes: Markdown[];
  loadQueryLink: (
    modelPath: string,
    sourceName: string,
    queryName: string
  ) => void;
}> = ({ nodes, loadQueryLink }) => {
  return (
    <>
      {nodes.map((childNode, index) => (
        <MarkdownNode
          node={childNode}
          key={index}
          loadQueryLink={loadQueryLink}
        />
      ))}
    </>
  );
};

interface MarkdownCodeBlockProps {
  code: string;
  language: string;
}

const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({
  code,
  language,
}) => {
  const [pre, setPre] = useState<HTMLElement>();

  useEffect(() => {
    highlightPre(code, language).then(setPre);
  }, [code, language]);

  return pre ? (
    <MarkdownPreWrapper>
      <DOMElement element={pre} />
    </MarkdownPreWrapper>
  ) : (
    <pre>{code}</pre>
  );
};

const MarkdownHeading1 = styled.h1`
  font-size: 21px;
  font-weight: 500;
  margin-block-end: 8px;
  margin-block-start: 16px;
`;

const MarkdownHeading2 = styled.h2`
  font-size: 19px;
  font-weight: 500;
  margin-block-end: 8px;
  margin-block-start: 16px;
`;

const MarkdownHeading3 = styled.h3`
  font-size: 17px;
  font-weight: 500;
  margin-block-end: 8px;
  margin-block-start: 16px;
`;

const MarkdownHeading4 = styled.h4`
  font-size: 15px;
  font-weight: 500;
  margin-block-end: 8px;
  margin-block-start: 16px;
`;

const MarkdownHeading5 = styled.h5`
  font-size: 14px;
  font-weight: 500;
  margin-block-end: 8px;
  margin-block-start: 16px;
`;

const MarkdownHeading6 = styled.h6`
  font-size: 14px;
  font-weight: 500;
  margin-block-end: 8px;
  margin-block-start: 16px;
`;

const MarkdownDocumentRoot = styled.div`
  padding: 10px 30px 30px 30px;
  width: 100%;
  font-family: Google Sans;
  max-width: 900px;
`;

const MarkdownLink = styled.a`
  color: ${COLORS.dimension.fillStrong};
`;

const MarkdownParagraph = styled.p`
  font-size: 14px;
  margin-block-start: 8px;
  color: #4B4C50;
`;

const MarkdownPreWrapper = styled.div`
  pre {
    font-size: 14px;
    border: 1px solid #efefef;
    border-radius: 5px;
    padding: 10px;
    background-color: #fbfbfb;
  }
`;
