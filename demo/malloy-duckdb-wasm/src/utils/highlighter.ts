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
import { ILanguageRegistration } from "shiki";
import { MALLOY_GRAMMAR } from "./malloyGrammar";

shiki.setCDN("https://unpkg.com/shiki/");

const HIGHLIGHTER = shiki.getHighlighter({
  theme: "light-plus",
  langs: [
    "sql",
    "json",
    {
      id: "malloy",
      scopeName: "source.malloy",
      embeddedLangs: ["sql"],
      grammar: MALLOY_GRAMMAR,
    } as unknown as ILanguageRegistration,
  ],
});

export async function highlight(code: string, lang: string): Promise<string> {
  const highlighter = await HIGHLIGHTER;
  if (!highlighter.getLoadedLanguages().includes(lang as shiki.Lang)) {
    lang = "txt";
  }
  return highlighter.codeToHtml(code, { lang });
}
