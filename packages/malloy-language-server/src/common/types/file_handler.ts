/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export interface CellMetadataConfig {
  [key: string]: unknown;
  connection?: string;
}

export interface CellMetadata {
  [key: string]: unknown;
  config?: CellMetadataConfig;
}

export interface Cell {
  uri: string;
  text: string;
  languageId: string;
  metadata?: CellMetadata;
  lineOffset: number;
}

export interface CellData {
  baseUri: string;
  cells: Cell[];
}

export interface BuildModelRequest {
  uri: string;
  languageId: string;
  refreshSchemaCache?: boolean;
}
