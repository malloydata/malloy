/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {JSXElement} from 'solid-js';
import type {
  RenderPluginFactory,
  SolidJSRenderPluginInstance,
  RenderProps,
} from '@/api/plugin-types'; // Assuming plugin-types.ts is updated
import {type Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';

interface DummyPluginMetadata {
  type: 'dummy';
  fieldName: string;
}

// Key Change 1: Specify the literal name and metadata type
interface DummyPluginInstance
  extends SolidJSRenderPluginInstance<'dummy', DummyPluginMetadata> {
  // Key Change 2: Declare custom methods here
  customDummyMethod(): number;
  // Also explicitly declare getMetadata if BaseRenderPluginInstance is strict
  getMetadata(): DummyPluginMetadata;
}

export const DummyPluginFactory: RenderPluginFactory<DummyPluginInstance> = {
  // The name property of the factory should implicitly be 'dummy' due to the TInstance['name'] constraint
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
      name: 'dummy' as const, // Key Change 3: Ensure 'dummy' is a literal
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

      customDummyMethod: () => 42,
    };
  },
};

// Export the type if it needs to be used elsewhere (e.g., for specific imports)
export type {DummyPluginInstance};
