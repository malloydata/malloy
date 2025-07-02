/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  RenderPluginFactory,
  RenderProps,
  SolidJSRenderPluginInstance,
} from '@/api/plugin-types';
import {type Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import type {JSXElement} from 'solid-js';
import {createResource, Suspense} from 'solid-js';

export interface SummarizePluginInstance
  extends SolidJSRenderPluginInstance<SummarizePluginMetadata> {
  field: Field;
}

interface SummarizePluginMetadata {
  type: 'summarize';
  field: Field;
}

interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

const generateSummaryPrompt = (jsonData: string): string => {
  return `You are an expert data analyst. Your task is to provide a concise, one-paragraph summary of the following JSON data.

Focus on identifying key trends, significant outliers, and any notable patterns or relationships within the data. Do not simply list or repeat the data. Your goal is to provide actionable insights based on the data provided.

Your entire response must be a single paragraph of text only.

Here is the data:

\`\`\`json
${jsonData}
\`\`\`
`;
};

const fetchSummaryFromOllama = async (dataColumn: any): Promise<string> => {
  if (!dataColumn.isRepeatedRecord()) {
    throw new Error('Data column is not a repeated record');
  }

  // Serialize the data to JSON
  const jsonData = JSON.stringify(dataColumn.rows, null, 2);
  const prompt = generateSummaryPrompt(jsonData);

  const request: OllamaRequest = {
    model: 'llama3',
    prompt: prompt,
    stream: false,
  };

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: OllamaResponse = await response.json();
    return result.response;
  } catch (error) {
    console.error('Error fetching summary from Ollama:', error);
    throw error;
  }
};

export const SummarizePluginFactory: RenderPluginFactory<SummarizePluginInstance> =
  {
    name: 'summarize',

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasSummarizeTag = fieldTag.has('summarize');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasSummarizeTag && !isRepeatedRecord) {
        throw new Error(
          'Malloy Summarize: field has summarize tag, but is not a repeated record'
        );
      }

      return hasSummarizeTag && isRepeatedRecord;
    },

    create: (field: Field): SummarizePluginInstance => {
      const pluginInstance: SummarizePluginInstance = {
        name: 'summarize',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fill',

        renderComponent: (props: RenderProps): JSXElement => {
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Summarize: data column is not a repeated record'
            );
          }

          const [summary] = createResource(() => props.dataColumn, fetchSummaryFromOllama);

          return (
            <div style={{ padding: '16px' }}>
              <Suspense fallback={<div>Analyzing data...</div>}>
                {summary.error ? (
                  <div style={{ color: 'red' }}>
                    Error fetching summary: {summary.error.message}
                  </div>
                ) : (
                  <div style={{
                    'line-height': '1.6',
                    'font-family': 'system-ui, -apple-system, sans-serif'
                  }}>
                    {summary()}
                  </div>
                )}
              </Suspense>
            </div>
          );
        },

        getMetadata: (): SummarizePluginMetadata => ({
          type: 'summarize',
          field,
        }),
      };

      return pluginInstance;
    },
  };