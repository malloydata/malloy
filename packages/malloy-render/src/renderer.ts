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

import { DataValue, DataPointer } from "./data_table";

export type ChildRenderers = { [fieldName: string]: Renderer };

export interface Renderer {
  render(
    dom: Document,
    value: DataValue,
    ref: DataPointer | undefined,
    onDrill: (drillQuery: string) => void
  ): Promise<Element>;
}

export abstract class RenderTree implements Renderer {
  protected abstract get childRenderers(): ChildRenderers;

  // abstract render(data: QueryValue, metadata: FieldDef): Promise<string>;
  abstract render(
    dom: Document,
    value: DataValue,
    ref: DataPointer | undefined,
    onDrill: (drillQuery: string) => void
  ): Promise<Element>;
}
