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

import * as shiki from "shiki";
import * as fs from "fs";

const json = fs.readFileSync(
  "./vscode-extension/malloy.tmGrammar.json",
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
