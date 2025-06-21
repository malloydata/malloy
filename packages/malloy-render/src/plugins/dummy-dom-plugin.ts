/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  RenderPluginFactory,
  DOMRenderPluginInstance,
  RenderProps,
} from '@/api/plugin-types';
import {type Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';

interface DummyDOMPluginMetadata {
  type: 'dummy_dom';
  fieldName: string;
}

type DummyDOMPluginInstance = DOMRenderPluginInstance<DummyDOMPluginMetadata>;

export const DummyDOMPluginFactory: RenderPluginFactory<DummyDOMPluginInstance> =
  {
    name: 'dummy_dom',

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      // Only match atomic fields (not nested structures) with # dummy_dom tag
      const isAtomicField =
        fieldType === FieldType.String ||
        fieldType === FieldType.Number ||
        fieldType === FieldType.Boolean ||
        fieldType === FieldType.Date ||
        fieldType === FieldType.Timestamp ||
        fieldType === FieldType.JSON ||
        fieldType === FieldType.SQLNative;

      return isAtomicField && fieldTag.has('dummy_dom');
    },

    create: (field: Field): DummyDOMPluginInstance => {
      return {
        name: 'dummy_dom',
        field,
        renderMode: 'dom',
        sizingStrategy: 'fixed',

        renderToDOM: (container: HTMLElement, props: RenderProps): void => {
          const cellValue = props.dataColumn.value;
          const displayValue = cellValue !== null ? String(cellValue) : 'null';

          // Clear container
          container.innerHTML = '';

          // Create DOM elements directly
          const wrapper = document.createElement('div');
          wrapper.style.cssText = `
          padding: 12px;
          border: 3px solid #dc3545;
          background: linear-gradient(45deg, #ffe6e6, #ffcccc);
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          color: #dc3545;
          font-weight: bold;
          text-align: center;
          box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
          position: relative;
          overflow: hidden;
        `;

          // Add animated background effect
          const bgEffect = document.createElement('div');
          bgEffect.style.cssText = `
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent, rgba(220, 53, 69, 0.1), transparent);
          animation: pulse 2s ease-in-out infinite;
          pointer-events: none;
        `;

          // Add keyframes for animation
          if (!document.getElementById('dummy-dom-keyframes')) {
            const style = document.createElement('style');
            style.id = 'dummy-dom-keyframes';
            style.textContent = `
            @keyframes pulse {
              0%, 100% { transform: translateX(-100%); }
              50% { transform: translateX(0%); }
            }
          `;
            document.head.appendChild(style);
          }

          // Create text content
          const textNode = document.createElement('div');
          textNode.style.cssText = 'position: relative; z-index: 1;';
          textNode.textContent = `🚀 DOM Hello: ${displayValue}`;

          // Assemble elements
          wrapper.appendChild(bgEffect);
          wrapper.appendChild(textNode);
          container.appendChild(wrapper);
        },

        cleanup: (container: HTMLElement): void => {
          // Clean up any event listeners or resources if needed
          container.innerHTML = '';
        },

        getMetadata: (): DummyDOMPluginMetadata => ({
          type: 'dummy_dom',
          fieldName: field.name,
        }),
      };
    },
  };
