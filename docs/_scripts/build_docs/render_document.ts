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

import unified from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { Markdown } from "./markdown_types";
import { runCode } from "./run_code";
import { log } from "./log";
import { highlight } from "./highlighter";

/*
 * A Renderer is capable of converting a parsed `Markdown` document into HTML,
 * given that it exists at a given `path`.
 */
class Renderer {
  // The path where the document being rendered exists.
  private readonly path: string;
  private models: Map<string, string>;
  private _errors: { snippet: string; error: string }[] = [];
  private readonly titleStack: { level: number; title: string }[] = [];
  public readonly searchSegments: { titles: string[]; paragraphs: string[] }[] =
    [];

  constructor(path: string) {
    this.path = path;
    this.models = new Map();
  }

  private setModel(modelPath: string, source: string) {
    this.models.set(modelPath, source);
  }

  protected async code(
    code: string,
    infostring: string | undefined,
    escaped: boolean
  ) {
    const lang = (infostring || "").trim();
    let showCode = code;
    let hidden = false;

    let result = "";
    if (lang === "malloy") {
      if (code.startsWith("--!")) {
        try {
          const options = JSON.parse(
            code.split("\n")[0].substring("--! ".length).trim()
          );
          showCode = showCode.split("\n").slice(1).join("\n");
          if (options.isHidden) {
            hidden = true;
          }
          if (options.isRunnable) {
            result = await runCode(showCode, this.path, options, this.models);
          } else if (options.isModel) {
            let modelCode = showCode;
            if (options.source) {
              const prefix = this.models.get(options.source);
              if (prefix === undefined) {
                throw new Error(`can't find source ${options.source}`);
              }
              modelCode = prefix + "\n" + showCode;
            }
            this.setModel(options.modelPath, modelCode);
          }
        } catch (error) {
          log(`  !! Error: ${error.toString()}`);
          result = `<div class="error">Error: ${error.toString()}</div>`;
          this._errors.push({ snippet: code, error: error.message });
        }
      }

      const codeBlock = await highlight(showCode, lang);
      return `${hidden ? "" : codeBlock}${result}`;
    }

    showCode = showCode.replace(/\n$/, "") + "\n";

    if (!lang) {
      return (
        "<pre><code>" +
        (escaped ? showCode : escape(showCode)) +
        "</code></pre>\n"
      );
    }

    return (
      '<pre><code class="' +
      "language-" +
      escape(lang) +
      '">' +
      (escaped ? showCode : escape(showCode)) +
      "</code></pre>\n"
    );
  }

  protected async blockquote(content: Markdown[]) {
    const quote = await this.children(content);
    return "<blockquote>\n" + quote + "</blockquote>\n";
  }

  protected async html(html: string) {
    return html;
  }

  private registerTitle(titleHTML: string, level: number) {
    for (;;) {
      const lastTitle = this.titleStack[this.titleStack.length - 1];
      if (lastTitle === undefined || lastTitle.level < level) {
        break;
      } else {
        this.titleStack.pop();
      }
    }
    this.titleStack.push({ level, title: titleHTML });
    this.searchSegments.push({
      titles: this.titleStack.map((item) => item.title),
      paragraphs: [],
    });
  }

  protected async heading(content: Markdown[], level: 1 | 2 | 3 | 4 | 5 | 6) {
    const text = await this.children(content);
    this.registerTitle(text, level);
    const escapedText = text.toLowerCase().replace(/[^\w]+/g, "-");

    return `
      <h${level}>
        <a id="${escapedText}" class="header-link anchor" href="#${escapedText}">
          ${text}
        </a>
      </h${level}>
    `;
  }

  protected async hr() {
    return "<hr/>\n";
  }

  protected async list(content: Markdown[], ordered: boolean, start: number) {
    const renderContent = async (item: Markdown) => {
      if (item.type !== "listItem") {
        throw new Error("Unexpected child of list renderer.");
      }
      return this.listItem(item.children, item.checked);
    };
    const body = (
      await Promise.all(content.map((item) => renderContent(item)))
    ).join("\n");
    const type = ordered ? "ol" : "ul",
      startatt = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startatt + ">\n" + body + "</" + type + ">\n";
  }

  protected async listItem(content: Markdown[], checked: boolean | null) {
    const text = await this.children(content);
    if (checked !== null) {
      return `<li class="task"><input ${checked ? "checked" : ""}
          disabled="" type="checkbox"
          />${text}</li>`;
    } else {
      return `<li>${text}</li>`;
    }
  }

  protected async paragraph(content: Markdown[]) {
    const text = await this.children(content);
    const segment = this.searchSegments[this.searchSegments.length - 1];
    if (segment) {
      segment.paragraphs.push(text);
    }
    return "<p>" + text + "</p>\n";
  }

  protected async table(
    content: Markdown[],
    align: ("left" | "right" | null)[]
  ) {
    const renderRow = async (row: Markdown, header: boolean) => {
      if (row.type !== "tableRow") {
        throw new Error("Expected table row.");
      }

      return this.tableRow(row.children, header, align);
    };

    const head = await renderRow(content[0], true);
    const body = (
      await Promise.all(content.slice(1).map((row) => renderRow(row, false)))
    ).join("\n");

    return (
      "<table>\n" +
      "<thead>\n" +
      head +
      "</thead>\n" +
      "<tbody>" +
      body +
      "</tbody>" +
      "</table>\n"
    );
  }

  protected async tableRow(
    cells: Markdown[],
    header: boolean,
    align: ("left" | "right" | null)[]
  ) {
    const renderCell = async (
      cell: Markdown,
      align: "left" | "right" | null
    ) => {
      if (cell.type !== "tableCell") {
        throw new Error("Expected table cell.");
      }

      return this.tablecell(cell.children, header, align);
    };

    const body = (
      await Promise.all(
        cells.map((cell, index) => renderCell(cell, align[index]))
      )
    ).join("\n");

    return "<tr>\n" + body + "</tr>\n";
  }

  protected async tablecell(
    content: Markdown[],
    header: boolean,
    align: "left" | "right" | null
  ) {
    const text = await this.children(content);
    const type = header ? "th" : "td";
    const tag = align
      ? "<" + type + ' align="' + align + '">'
      : "<" + type + ">";
    return tag + text + "</" + type + ">\n";
  }

  protected async strong(content: Markdown[]) {
    const text = await this.children(content);
    return "<strong>" + text + "</strong>";
  }

  protected async emphasis(content: Markdown[]) {
    const text = await this.children(content);
    return "<em>" + text + "</em>";
  }

  protected async codeSpan(text: string) {
    return highlight(text, "malloy", { inline: true });
  }

  protected async break() {
    return "<br/>";
  }

  protected async delete(content: Markdown[]) {
    const text = await this.children(content);
    return "<del>" + text + "</del>";
  }

  protected async link(
    href: string | null,
    title: string | null,
    content: Markdown[]
  ) {
    const text = await this.children(content);
    if (href === null) {
      return text;
    }
    href = href.replace(/\.md/, ".html");
    let out = href.startsWith("/")
      ? `<a href="{{ '${href}' | relative_url }}"`
      : `<a href="${href}"`;
    if (title) {
      out += ' title="' + title + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }

  protected async image(
    href: string | null,
    title: string | null,
    text: string
  ) {
    if (href === null) {
      return text;
    }

    let out = '<img src="' + href + '" alt="' + text + '"';
    if (title) {
      out += ' title="' + title + '"';
    }
    out += "/>";
    return out;
  }

  protected async text(text: string) {
    return text;
  }

  protected async children(children: Markdown[]) {
    return (
      await Promise.all(children.map((child) => this.render(child)))
    ).join("");
  }

  private async root(children: Markdown[]) {
    return `<div class="document">${await this.children(children)}</div>`;
  }

  async render(ast: Markdown): Promise<string> {
    switch (ast.type) {
      case "root":
        return this.root(ast.children);
      case "heading":
        return this.heading(ast.children, ast.depth);
      case "text":
        return this.text(ast.value);
      case "paragraph":
        return this.paragraph(ast.children);
      case "link":
        return this.link(ast.url, ast.title, ast.children);
      case "emphasis":
        return this.emphasis(ast.children);
      case "strong":
        return this.strong(ast.children);
      case "list":
        return this.list(ast.children, ast.ordered, ast.start || 0);
      case "table":
        return this.table(ast.children, ast.align);
      case "inlineCode":
        return this.codeSpan(ast.value);
      case "code":
        return this.code(ast.value, ast.lang, false);
      case "blockquote":
        return this.blockquote(ast.children);
      case "break":
        return this.break();
      case "thematicBreak":
        return this.hr();
      case "html":
        return this.html(ast.value);
      case "image":
        return this.image(ast.url, ast.title, ast.alt);
      case "delete":
        return this.delete(ast.children);
      default:
        throw new Error(`Unexpected markdown node type.`);
    }
  }

  get errors() {
    return this._errors;
  }
}

export async function renderDoc(
  text: string,
  path: string
): Promise<{
  renderedDocument: string;
  errors: { snippet: string; error: string }[];
  searchSegments: { titles: string[]; paragraphs: string[] }[];
}> {
  const ast = unified().use(remarkParse).use(remarkGfm).parse(text);
  const renderer = new Renderer(path);
  const renderedDocument = await renderer.render(ast as unknown as Markdown);
  return {
    renderedDocument,
    errors: renderer.errors,
    searchSegments: renderer.searchSegments,
  };
}
