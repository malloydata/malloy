/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {JSXElement} from 'solid-js';
import type {
  RenderPluginFactory,
  SolidJSRenderPluginInstance,
  RenderProps,
} from '@/api/plugin-types';
import {type Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';

interface DummyPluginMetadata {
  type: 'dummy';
  fieldName: string;
}

type DummyPluginInstance = SolidJSRenderPluginInstance<DummyPluginMetadata>;

export const DummyPluginFactory: RenderPluginFactory<DummyPluginInstance> = {
  name: 'dummy',

  matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
    // Only match atomic fields (not nested structures) with # dummy tag
    const isAtomicField =
      fieldType === FieldType.String ||
      fieldType === FieldType.Number ||
      fieldType === FieldType.Boolean ||
      fieldType === FieldType.Date ||
      fieldType === FieldType.Timestamp ||
      fieldType === FieldType.JSON ||
      fieldType === FieldType.SQLNative;

    return isAtomicField && fieldTag.has('dummy');
  },

  create: (field: Field): DummyPluginInstance => {
    return {
      name: 'dummy',
      field,
      renderMode: 'solidjs',
      sizingStrategy: 'fixed',

      renderComponent: (props: RenderProps): JSXElement => {
        const cellValue = props.dataColumn.value;
        const displayValue = cellValue !== null ? String(cellValue) : 'null';

        return (
          <div
            style={{
              'padding': '8px',
              'border': '2px dashed #007acc',
              'background-color': '#f0f8ff',
              'border-radius': '4px',
              'font-family': 'monospace',
              'color': '#007acc',
            }}
          >
            Hello World: {displayValue}
          </div>
        );
      },

      getMetadata: (): DummyPluginMetadata => ({
        type: 'dummy',
        fieldName: field.name,
      }),
    };
  },
};
