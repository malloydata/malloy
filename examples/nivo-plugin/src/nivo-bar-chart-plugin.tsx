/*
 * Malloy Nivo Bar Chart Plugin Example
 *
 * This plugin demonstrates how to integrate Nivo (React charting library)
 * with Malloy's plugin system using a DOM-based rendering approach.
 */

import type {
  RenderPluginFactory,
  DOMRenderPluginInstance,
  RenderProps,
} from '@malloydata/render/api/plugin-types';
import { type Field, FieldType } from '@malloydata/render/data_tree';
import type { Tag } from '@malloydata/malloy-tag';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ResponsiveBar } from '@nivo/bar';

interface NivoBarChartPluginMetadata {
  type: 'nivo_bar_chart';
  fieldName: string;
}

interface NivoBarChartOptions {
  /** Chart color scheme (e.g., 'nivo', 'category10', 'accent') */
  colorScheme?: string;
  /** Enable/disable chart legends */
  showLegends?: boolean;
  /** Enable/disable animations */
  enableAnimations?: boolean;
  /** Bar padding (0-1) */
  padding?: number;
  /** Chart layout direction */
  layout?: 'horizontal' | 'vertical';
}

type NivoBarChartPluginInstance =
  DOMRenderPluginInstance<NivoBarChartPluginMetadata>;

/**
 * Factory for creating Nivo Bar Chart plugin instances.
 *
 * Matches fields tagged with #nivo_bar_chart that are repeated records.
 *
 * Usage in Malloy:
 * ```malloy
 * source: sales is table('sales') {
 *   dimension: product_name
 *   measure: total_sales is sum(sales_amount)
 * }
 *
 * query: sales -> {
 *   nest: by_product is {
 *     group_by: product_name
 *     aggregate: total_sales
 *   } # nivo_bar_chart
 * }
 * ```
 */
export const NivoBarChartPluginFactory: RenderPluginFactory<NivoBarChartPluginInstance> =
  {
    name: 'nivo_bar_chart',

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasNivoBarChartTag = fieldTag.has('nivo_bar_chart');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      // Validate that the field is a repeated record
      if (hasNivoBarChartTag && !isRepeatedRecord) {
        throw new Error(
          'Nivo Bar Chart plugin requires a repeated record field. ' +
            `Field "${field.name}" is of type ${FieldType[fieldType]}.`
        );
      }

      return hasNivoBarChartTag && isRepeatedRecord;
    },

    create: (
      field: Field,
      pluginOptions?: unknown
    ): NivoBarChartPluginInstance => {
      const options = (pluginOptions as NivoBarChartOptions) || {};
      let reactRoot: ReactDOM.Root | null = null;

      return {
        name: 'nivo_bar_chart',
        field,
        renderMode: 'dom',
        sizingStrategy: 'fill',

        renderToDOM: (container: HTMLElement, props: RenderProps): void => {
          if (!props.dataColumn.isRepeatedRecord()) {
            container.innerHTML = `
              <div style="padding: 20px; color: #d32f2f; border: 2px solid #d32f2f; border-radius: 4px;">
                <strong>Error:</strong> Nivo Bar Chart requires repeated record data
              </div>
            `;
            return;
          }

          try {
            // Extract data from Malloy repeated record
            const rows = props.dataColumn.rows;
            const childFields = props.field.isNest()
              ? props.field.children
              : [];

            if (rows.length === 0) {
              container.innerHTML = `
                <div style="padding: 20px; color: #666; text-align: center;">
                  No data available to display
                </div>
              `;
              return;
            }

            // Transform Malloy data to Nivo format
            const data = rows.map(row => {
              const datum: Record<string, any> = {};

              childFields.forEach(childField => {
                const cell = row.column(childField.name);
                let value = cell.value;

                // Handle different data types
                if (value === null || value === undefined) {
                  value = 0;
                } else if (childField.isDate() || childField.isTime()) {
                  // Format dates as strings
                  value = String(value);
                } else if (childField.isNumber()) {
                  // Ensure numbers are numeric
                  value = Number(value);
                }

                datum[childField.name] = value;
              });

              return datum;
            });

            // Determine keys for the bar chart (numeric/measure fields)
            const keys = childFields
              .filter(field => field.isNumber())
              .map(field => field.name);

            // Determine the index key (first non-numeric field, typically a dimension)
            const indexBy = childFields.find(field => !field.isNumber())?.name || 'index';

            // Configure Nivo Bar Chart
            const NivoBarChart = () => (
              <div style={{ width: '100%', height: '400px' }}>
                <ResponsiveBar
                  data={data}
                  keys={keys}
                  indexBy={indexBy}
                  margin={{ top: 50, right: 130, bottom: 50, left: 60 }}
                  padding={options.padding ?? 0.3}
                  layout={options.layout ?? 'vertical'}
                  valueScale={{ type: 'linear' }}
                  indexScale={{ type: 'band', round: true }}
                  colors={{ scheme: options.colorScheme || 'nivo' }}
                  borderColor={{
                    from: 'color',
                    modifiers: [['darker', 1.6]],
                  }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: indexBy,
                    legendPosition: 'middle',
                    legendOffset: 32,
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: keys.length > 0 ? keys[0] : 'value',
                    legendPosition: 'middle',
                    legendOffset: -40,
                  }}
                  labelSkipWidth={12}
                  labelSkipHeight={12}
                  labelTextColor={{
                    from: 'color',
                    modifiers: [['darker', 1.6]],
                  }}
                  legends={
                    options.showLegends !== false
                      ? [
                          {
                            dataFrom: 'keys',
                            anchor: 'bottom-right',
                            direction: 'column',
                            justify: false,
                            translateX: 120,
                            translateY: 0,
                            itemsSpacing: 2,
                            itemWidth: 100,
                            itemHeight: 20,
                            itemDirection: 'left-to-right',
                            itemOpacity: 0.85,
                            symbolSize: 20,
                            effects: [
                              {
                                on: 'hover',
                                style: {
                                  itemOpacity: 1,
                                },
                              },
                            ],
                          },
                        ]
                      : []
                  }
                  animate={options.enableAnimations !== false}
                  motionConfig="gentle"
                  role="application"
                  ariaLabel="Nivo bar chart"
                  barAriaLabel={e =>
                    `${e.id}: ${e.formattedValue} in ${indexBy}: ${e.indexValue}`
                  }
                />
              </div>
            );

            // Render React component into the container
            if (!reactRoot) {
              reactRoot = ReactDOM.createRoot(container);
            }
            reactRoot.render(<NivoBarChart />);
          } catch (error) {
            console.error('Error rendering Nivo Bar Chart:', error);
            container.innerHTML = `
              <div style="padding: 20px; color: #d32f2f; border: 2px solid #d32f2f; border-radius: 4px;">
                <strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}
              </div>
            `;
          }
        },

        cleanup: (container: HTMLElement): void => {
          // Cleanup React root when component is unmounted
          if (reactRoot) {
            reactRoot.unmount();
            reactRoot = null;
          }
          container.innerHTML = '';
        },

        getMetadata: (): NivoBarChartPluginMetadata => ({
          type: 'nivo_bar_chart',
          fieldName: field.name,
        }),
      };
    },
  };
