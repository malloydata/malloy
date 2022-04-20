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

export type ColorKey =
  | "dimension"
  | "measure"
  | "filter"
  | "query"
  | "source"
  | "other"
  | "error";

export const COLORS = {
  dimension: {
    fillLight: "rgb(240,246,255)",
    fillMedium: "#c3d7f7",
    fillStrong: "#4285f4",
  },
  measure: {
    fillStrong: "#ea8600",
    fillMedium: "#f3cfa1",
    fillLight: "#fff3e8",
  },
  filter: {
    fillStrong: "#8166da",
    fillMedium: "#d4d6d8",
    fillLight: "#f8f6ff",
  },
  query: {
    fillStrong: "rgb(56,169,86)",
    fillMedium: "#bce0c5",
    fillLight: "#f3fbf5",
  },
  source: {
    fillStrong: "rgb(56,169,86)",
    fillMedium: "#bce0c5",
    fillLight: "#f3fbf5",
  },
  other: {
    fillStrong: "#9aa0a6",
    fillMedium: "#d4d6d8",
    fillLight: "#f7f8f8",
  },
  error: {
    fillStrong: "#9aa0a6",
    fillMedium: "#d4d6d8",
    fillLight: "#f7f8f8",
  },
};
