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
import malloyTMGrammar from "../../../malloy.tmGrammar.json";

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

export async function highlight(code: string, lang: string): Promise<string> {
  const highlighter = await HIGHLIGHTER;
  const highlightedRaw = highlighter.codeToHtml(code, { lang });
  return highlightedRaw
    .replace(/^<pre class="shiki"/, `<code class="language-${lang}"`)
    .replace("<code>", "")
    .replace(/<\/pre>$/, "");
}
