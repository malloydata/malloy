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

import { Markdown, parseMarkdown } from "../../core/markdown";

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
  console.log(markdown, loadQueryLink);

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
      return children(node);
    case "heading":
      switch (node.depth) {
        case 1:
          return <h1>{children(node)}</h1>;
        case 2:
          return <h2>{children(node)}</h2>;
        case 3:
          return <h3>{children(node)}</h3>;
        case 4:
          return <h4>{children(node)}</h4>;
        case 5:
          return <h5>{children(node)}</h5>;
        case 6:
          return <h6>{children(node)}</h6>;
      }
      return <div />;
    case "text":
      return <span>{node.value}</span>;
    case "strong":
      return <b>{children(node)}</b>;
    case "paragraph":
      return <p>{children(node)}</p>;
    case "link":
      return (
        <a href={node.url}>
          {children(node)}
          {node.title}
        </a>
      );
    case "emphasis":
      return <i>{children(node)}</i>;
    case "blockquote":
      return <blockquote>{children(node)}</blockquote>;
    case "break":
      return <br />;
    case "code":
      return <pre>{node.value}</pre>;
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
            <button
              onClick={() => {
                loadQueryLink(
                  node.attributes?.model || "",
                  node.attributes?.source || "",
                  node.attributes?.query || ""
                );
              }}
            >
              Load Query
            </button>
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
