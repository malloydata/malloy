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

import { FieldDef, StructDef } from "@malloydata/malloy";
import * as shiki from "shiki";
import { ILanguageRegistration } from "shiki";
import { QuerySummaryItem } from "../types";
import { MALLOY_GRAMMAR } from "./malloyGrammar";

shiki.setCDN("https://unpkg.com/shiki/");

export function snakeToTitle(snake: string): string {
  return snake
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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

export async function highlightPre(
  code: string,
  lang: string
): Promise<HTMLDivElement> {
  const highlighted = await highlight(code, lang);
  const elem = document.createElement("div");
  elem.innerHTML = highlighted;
  return elem;
}

export function typeOfField(
  fieldDef: FieldDef
): "string" | "number" | "boolean" | "date" | "timestamp" | "query" | "source" {
  return fieldDef.type === "struct"
    ? "source"
    : fieldDef.type === "turtle"
    ? "query"
    : fieldDef.type;
}

export function kindOfField(
  fieldDef: FieldDef
): "query" | "source" | "dimension" | "measure" {
  return fieldDef.type === "struct"
    ? "source"
    : fieldDef.type === "turtle"
    ? "query"
    : fieldDef.aggregate
    ? "measure"
    : "dimension";
}

export function notUndefined<T>(item: T | undefined): item is T {
  return item !== undefined;
}

export function fieldToSummaryItem(
  field: FieldDef,
  path: string
): QuerySummaryItem {
  const kind = kindOfField(field);
  if (field.type === "struct" || kind === "source") {
    throw new Error("Cannot make a summary item from a struct.");
  } else {
    return {
      type: "field",
      field,
      path,
      isRefined: false,
      name: field.as || field.name,
      isRenamed: false,
      fieldIndex: -1,
      kind,
    };
  }
}

export function isAggregate(field: FieldDef): boolean {
  return (
    field.type !== "struct" && field.type !== "turtle" && !!field.aggregate
  );
}

export function isDimension(field: FieldDef): boolean {
  return field.type !== "struct" && field.type !== "turtle" && !field.aggregate;
}

export function isQuery(field: FieldDef): boolean {
  return field.type === "turtle";
}

export function flatFields(
  source: StructDef,
  path: string[] = []
): { field: FieldDef; path: string }[] {
  return source.fields.flatMap((field) => {
    if (field.type === "struct") {
      return flatFields(field, [...path, field.as || field.name]);
    } else {
      return [{ field, path: [...path, field.as || field.name].join(".") }];
    }
  });
}

export function pathSuffixes(path: string): string[] {
  const parts = path.split(".");
  return parts.map((_, index) => parts.slice(index).join("."));
}

export function termsForField(field: FieldDef, path: string): string[] {
  return [
    ...pathSuffixes(path).reverse(),
    field.name,
    kindOfField(field),
    typeOfField(field),
  ];
}

export function pathParent(path: string): string {
  const parts = path.split(".");
  return parts[parts.length - 2];
}

export function largeNumberLabel(n: number): string {
  if (n < 1_000) {
    return n.toLocaleString();
  } else if (n < 10_000) {
    return (n / 1000).toFixed(1) + "K";
  } else if (n < 1_000_000) {
    return Math.floor(n / 1000).toLocaleString() + "K";
  } else if (n < 10_000_000) {
    return (n / 1_000_000).toFixed(1) + "M";
  } else {
    return Math.floor(n / 1000).toLocaleString() + "M";
  }
}
