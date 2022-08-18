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

import * as shiki from "shiki";
import * as fs from "fs";

const json = fs.readFileSync(
  "./packages/malloy-vscode/malloy.tmGrammar.json",
  "utf-8"
);
const malloyTMGrammar = JSON.parse(json);

const HIGHLIGHTER = shiki.getHighlighter({
  theme: "light-plus",
  langs: [
    "sql",
    "json",
    {
      id: "malloy",
      scopeName: "source.malloy",
      embeddedLangs: ["sql"],
      grammar: malloyTMGrammar as any,
    },
  ],
});

export async function highlight(
  code: string,
  lang: string,
  { inline }: { inline?: boolean } = {}
): Promise<string> {
  const highlighter = await HIGHLIGHTER;
  if (!highlighter.getLoadedLanguages().includes(lang as shiki.Lang)) {
    lang = "txt";
  }
  const highlightedRaw = highlighter.codeToHtml(code, { lang });
  if (inline) {
    return highlightedRaw
      .replace(/^<pre class="shiki"/, `<code class="language-${lang}"`)
      .replace("<code>", "")
      .replace(/<\/pre>$/, "")
      .replace("background-color: #FFFFFF", "background-color: #FBFBFB");
  } else {
    return highlightedRaw
      .replace(/^<pre class="shiki"/, `<pre class="language-${lang}"`)
      .replace("<code>", "")
      .replace(/<\/code><\/pre>$/, "</pre>")
      .replace("background-color: #FFFFFF", "background-color: #FBFBFB");
  }
}
