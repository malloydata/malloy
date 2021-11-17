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

/*
 * A markdown document, as returned from unified when parsing Remark with GFM.
 */
export type Markdown =
  | Root
  | Strong
  | HTML
  | Break
  | Heading
  | Text
  | Paragraph
  | Link
  | Emphasis
  | List
  | ListItem
  | Table
  | TableRow
  | TableCell
  | InlineCode
  | Code
  | Blockquote
  | Image
  | Delete
  | ThematicBreak;

export interface Root {
  type: "root";
  children: Markdown[];
}

export interface Break {
  type: "break";
}

export interface Image {
  type: "image";
  url: string;
  title: string | null;
  alt: string;
}

export interface Delete {
  type: "delete";
  children: Markdown[];
}

export interface Blockquote {
  type: "blockquote";
  children: Markdown[];
}

export interface Heading {
  type: "heading";
  children: Markdown[];
  depth: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface Text {
  type: "text";
  value: string;
}

export interface HTML {
  type: "html";
  value: string;
}

export interface Code {
  type: "code";
  lang: string;
  meta: string | null;
  value: string;
}

export interface Link {
  type: "link";
  title: string | null;
  url: string;
  children: Markdown[];
}

export interface Paragraph {
  type: "paragraph";
  children: Markdown[];
}

export interface Emphasis {
  type: "emphasis";
  children: Markdown[];
}

export interface Strong {
  type: "strong";
  children: Markdown[];
}

export interface List {
  type: "list";
  ordered: boolean;
  start: number | null;
  spread: boolean;
  children: Markdown[];
}

export interface ListItem {
  type: "listItem";
  checked: boolean | null;
  spread: boolean;
  children: Markdown[];
}

export interface Table {
  type: "table";
  align: ("left" | "right" | null)[];
  children: Markdown[];
}

export interface TableRow {
  type: "tableRow";
  children: Markdown[];
}

export interface TableCell {
  type: "tableCell";
  children: Markdown[];
}

export interface InlineCode {
  type: "inlineCode";
  value: string;
}

export interface ThematicBreak {
  type: "thematicBreak";
}
