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
  return `You are an expert data analyst. Your task is to provide a concise, one-paragraph summary of the provided data structure.

The data contains two components:
- parentContext: Hierarchical context data from all parent rows containing this nested data (provides broader context)
- nestedData: The specific nested dataset you should focus your analysis on

Focus on identifying key trends, significant outliers, and any notable patterns or relationships within the nested data, while using the parent context to provide meaningful business insights. Do not reference "parentContext" or "nestedData" in your response - treat them as natural parts of the analysis. Your goal is to provide actionable insights that consider both the specific nested data patterns and their broader context.

Your entire response must be a single paragraph of text only.

Here is the data:

\`\`\`json
${jsonData}
\`\`\`
`;
};

const fetchSummaryFromOllama = async (dataColumn: any, parentContext?: any): Promise<string> => {
  if (!dataColumn.isRepeatedRecord()) {
    throw new Error('Data column is not a repeated record');
  }

  // Extract data from rows without circular references
  const data: any[] = [];
  const rows = dataColumn.rows;
  
  for (const row of rows) {
    const rowData: Record<string, any> = {};
    for (const field of dataColumn.field.fields) {
      if (!field.isHidden()) {
        const cellValue = row.column(field.name).value;
        rowData[field.name] = cellValue;
      }
    }
    data.push(rowData);
  }

  // Combine parent context with nested data for the prompt
  const contextData = {
    parentContext: parentContext || null,
    nestedData: data
  };

  // Serialize the combined data to JSON
  const jsonData = JSON.stringify(contextData, null, 2);
  const prompt = generateSummaryPrompt(jsonData);

  const request: OllamaRequest = {
    model: 'llama3.2',
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

          // Extract parent context from all levels
          const getParentContext = () => {
            try {
              const currentRowPath = props.customProps?.table?.currentRow as number[] | undefined;
              
              if (!currentRowPath || currentRowPath.length === 0) {
                return null; // No parent context at root level
              }

              // Get the root data
              const rootData = props.dataColumn.root();
              
              const parentContextLevels: Array<{data: Record<string, any>, nestedFieldName?: string}> = [];
              let currentData = rootData;
              
              // Navigate through each level of the path to collect context
              for (let i = 0; i < currentRowPath.length; i++) {
                const rowIndex = currentRowPath[i];
                
                if (currentData.isRepeatedRecord() && currentData.rows && currentData.rows[rowIndex]) {
                  const currentRow = currentData.rows[rowIndex];
                  
                  if (currentRow.isRecord && currentRow.isRecord()) {
                    const levelData: Record<string, any> = {};
                    const levelFields = currentRow.field.fields.filter((f: any) => !f.isHidden() && !f.isNest());
                    
                    for (const field of levelFields) {
                      try {
                        const cellValue = currentRow.column(field.name).value;
                        levelData[field.name] = cellValue;
                      } catch (e) {
                        // Skip fields that can't be accessed
                      }
                    }
                    
                    let nextNestedFieldName: string | undefined;
                    
                    // For the next iteration, we need to find the nested data
                    if (i < currentRowPath.length - 1) {
                      // Try to find the next level of nested data
                      // Look for nested fields in this row
                      const nestedFields = currentRow.field.fields.filter((f: any) => f.isNest() && !f.isHidden());
                      
                      if (nestedFields.length > 0) {
                        // Try the first nested field (this might need to be more sophisticated)
                        const nextNestedField = nestedFields[0];
                        nextNestedFieldName = nextNestedField.name;
                        
                        try {
                          const nextLevelData = currentRow.column(nextNestedField.name);
                          
                          if (nextLevelData.isRepeatedRecord && nextLevelData.isRepeatedRecord()) {
                            currentData = nextLevelData;
                          } else {
                            break;
                          }
                        } catch (e) {
                          break;
                        }
                      } else {
                        break;
                      }
                    }
                    
                    if (Object.keys(levelData).length > 0) {
                      parentContextLevels.push({data: levelData, nestedFieldName: nextNestedFieldName});
                    }
                  }
                } else {
                  break;
                }
              }
              
              // Create a proper nested structure that mirrors the data hierarchy
              if (parentContextLevels.length === 0) {
                return null;
              } else if (parentContextLevels.length === 1) {
                return parentContextLevels[0].data;
              } else {
                // Build nested structure from the hierarchy
                // Start with the outermost level and nest inward
                let result = {...parentContextLevels[0].data};
                
                for (let i = 1; i < parentContextLevels.length; i++) {
                  const nestedFieldName = parentContextLevels[i - 1].nestedFieldName;
                  if (nestedFieldName) {
                    result[nestedFieldName] = parentContextLevels[i].data;
                  }
                }
                
                return result;
              }
            } catch (error) {
              return null;
            }
          };

          const parentContext = getParentContext();
          const [summary] = createResource(() => ({ dataColumn: props.dataColumn, parentContext }), 
            ({ dataColumn, parentContext }) => fetchSummaryFromOllama(dataColumn, parentContext));

          // Extract data for debugging
          const debugData = () => {
            const data: any[] = [];
            const rows = props.dataColumn.rows;
            
            for (const row of rows) {
              const rowData: Record<string, any> = {};
              for (const field of props.dataColumn.field.fields) {
                if (!field.isHidden()) {
                  const cellValue = row.column(field.name).value;
                  rowData[field.name] = cellValue;
                }
              }
              data.push(rowData);
            }
            
            return {
              parentContext,
              nestedData: data
            };
          };

          return (
            <div style={{ padding: '16px' }}>
              <Suspense fallback={<div>Analyzing data...</div>}>
                {summary.error ? (
                  <div style={{ color: 'red' }}>
                    Error fetching summary: {summary.error.message}
                  </div>
                ) : (
                  <>
                    <div style={{
                      'line-height': '1.6',
                      'font-family': 'system-ui, -apple-system, sans-serif',
                      'margin-bottom': '16px'
                    }}>
                      {summary()}
                    </div>
                    <details style={{ 'margin-top': '16px' }}>
                      <summary style={{ cursor: 'pointer', 'font-size': '12px', color: '#666' }}>
                        Debug: Raw Data
                      </summary>
                      <pre style={{ 
                        'font-size': '11px', 
                        'overflow': 'auto',
                        'background': '#f5f5f5',
                        'padding': '8px',
                        'border-radius': '4px',
                        'margin-top': '8px'
                      }}>
                        {JSON.stringify(debugData(), null, 2)}
                      </pre>
                    </details>
                  </>
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