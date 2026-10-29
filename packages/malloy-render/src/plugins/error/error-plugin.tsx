/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {RenderPluginInstance, RenderProps} from '@/api/plugin-types';
import {ErrorMessage} from '@/component/error-message/error-message';
import {StringField} from '@/data_tree/fields';
import type {StringFieldInfo} from '@/data_tree/types';
import type {JSXElement} from 'solid-js';

const dummyFieldInfo: StringFieldInfo = {
  name: 'error',
  type: {kind: 'string_type'},
  annotations: [],
};

const dummyField = new StringField(dummyFieldInfo, undefined);

export const ErrorPlugin = {
  create: (message: string): RenderPluginInstance => {
    return {
      name: 'error',
      field: dummyField,
      renderMode: 'solidjs',
      sizingStrategy: 'fill',
      renderComponent: (_props: RenderProps): JSXElement => {
        return <ErrorMessage message={message} />;
      },
      getMetadata: () => ({message}),
    };
  },
};
