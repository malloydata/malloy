/*
 * Malloy Nivo Pie Chart Plugin Example
 *
 * This plugin demonstrates how to create a pie chart visualization
 * using Nivo's ResponsivePie component with Malloy data.
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
import { ResponsivePie } from '@nivo/pie';

interface NivoPieChartPluginMetadata {
  type: 'nivo_pie_chart';
  fieldName: string;
}

interface NivoPieChartOptions {
  /** Color scheme for pie slices */
  colorScheme?: string;
  /** Enable/disable slice labels */
  enableSliceLabels?: boolean;
  /** Enable/disable arc link labels */
  enableArcLinkLabels?: boolean;
  /** Inner radius (0-1) - creates donut chart when > 0 */
  innerRadius?: number;
  /** Padding angle between slices in degrees */
  padAngle?: number;
  /** Corner radius of slices */
  cornerRadius?: number;
}

type NivoPieChartPluginInstance =
  DOMRenderPluginInstance<NivoPieChartPluginMetadata>;

/**
 * Factory for creating Nivo Pie Chart plugin instances.
 *
 * Matches fields tagged with #nivo_pie_chart that are repeated records.
 *
 * Usage in Malloy:
 * ```malloy
 * query: sales -> {
 *   nest: by_category is {
 *     group_by: category
 *     aggregate: total is sum(amount)
 *   } # nivo_pie_chart
 * }
 * ```
 */
export const NivoPieChartPluginFactory: RenderPluginFactory<NivoPieChartPluginInstance> =
  {
    name: 'nivo_pie_chart',

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasNivoPieChartTag = fieldTag.has('nivo_pie_chart');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasNivoPieChartTag && !isRepeatedRecord) {
        throw new Error(
          'Nivo Pie Chart plugin requires a repeated record field. ' +
            `Field "${field.name}" is of type ${FieldType[fieldType]}.`
        );
      }

      return hasNivoPieChartTag && isRepeatedRecord;
    },

    create: (
      field: Field,
      pluginOptions?: unknown
    ): NivoPieChartPluginInstance => {
      const options = (pluginOptions as NivoPieChartOptions) || {};
      let reactRoot: ReactDOM.Root | null = null;

      return {
        name: 'nivo_pie_chart',
        field,
        renderMode: 'dom',
        sizingStrategy: 'fill',

        renderToDOM: (container: HTMLElement, props: RenderProps): void => {
          if (!props.dataColumn.isRepeatedRecord()) {
            container.innerHTML = `
              <div style="padding: 20px; color: #d32f2f; border: 2px solid #d32f2f; border-radius: 4px;">
                <strong>Error:</strong> Nivo Pie Chart requires repeated record data
              </div>
            `;
            return;
          }

          try {
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

            // For pie charts, we need an id field and a value field
            // First field should be the label/id, first numeric field is the value
            const labelField = childFields[0];
            const valueField = childFields.find(field => field.isNumber());

            if (!labelField || !valueField) {
              container.innerHTML = `
                <div style="padding: 20px; color: #d32f2f; border: 2px solid #d32f2f; border-radius: 4px;">
                  <strong>Error:</strong> Pie chart requires at least one dimension and one measure field
                </div>
              `;
              return;
            }

            // Transform data to Nivo pie format
            const data = rows.map(row => {
              const labelCell = row.column(labelField.name);
              const valueCell = row.column(valueField.name);

              return {
                id: String(labelCell.value ?? 'Unknown'),
                label: String(labelCell.value ?? 'Unknown'),
                value: Number(valueCell.value ?? 0),
              };
            });

            // Nivo Pie Chart Component
            const NivoPieChart = () => (
              <div style={{ width: '100%', height: '400px' }}>
                <ResponsivePie
                  data={data}
                  margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
                  innerRadius={options.innerRadius ?? 0}
                  padAngle={options.padAngle ?? 0.7}
                  cornerRadius={options.cornerRadius ?? 3}
                  activeOuterRadiusOffset={8}
                  borderWidth={1}
                  borderColor={{
                    from: 'color',
                    modifiers: [['darker', 0.2]],
                  }}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="#333333"
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor={{
                    from: 'color',
                    modifiers: [['darker', 2]],
                  }}
                  colors={{ scheme: options.colorScheme || 'nivo' }}
                  enableArcLinkLabels={options.enableArcLinkLabels !== false}
                  arcLinkLabel="label"
                  arcLabel={d => `${d.value}`}
                  legends={[
                    {
                      anchor: 'bottom',
                      direction: 'row',
                      justify: false,
                      translateX: 0,
                      translateY: 56,
                      itemsSpacing: 0,
                      itemWidth: 100,
                      itemHeight: 18,
                      itemTextColor: '#999',
                      itemDirection: 'left-to-right',
                      itemOpacity: 1,
                      symbolSize: 18,
                      symbolShape: 'circle',
                      effects: [
                        {
                          on: 'hover',
                          style: {
                            itemTextColor: '#000',
                          },
                        },
                      ],
                    },
                  ]}
                  role="application"
                  ariaLabel="Nivo pie chart"
                />
              </div>
            );

            // Render React component
            if (!reactRoot) {
              reactRoot = ReactDOM.createRoot(container);
            }
            reactRoot.render(<NivoPieChart />);
          } catch (error) {
            console.error('Error rendering Nivo Pie Chart:', error);
            container.innerHTML = `
              <div style="padding: 20px; color: #d32f2f; border: 2px solid #d32f2f; border-radius: 4px;">
                <strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}
              </div>
            `;
          }
        },

        cleanup: (container: HTMLElement): void => {
          if (reactRoot) {
            reactRoot.unmount();
            reactRoot = null;
          }
          container.innerHTML = '';
        },

        getMetadata: (): NivoPieChartPluginMetadata => ({
          type: 'nivo_pie_chart',
          fieldName: field.name,
        }),
      };
    },
  };
