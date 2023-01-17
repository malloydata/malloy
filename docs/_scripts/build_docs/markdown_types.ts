/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
