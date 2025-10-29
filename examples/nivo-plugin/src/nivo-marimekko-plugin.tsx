/*
 * Malloy Nivo Marimekko Chart Plugin Example
 *
 * Marimekko charts (also called Mekko charts or mosaic plots) are two-dimensional
 * stacked charts where both width and height vary to show relationships between
 * two categorical variables and their proportions.
 *
 * Perfect for showing market share analysis, budget allocation, or any scenario
 * where you need to visualize the relationship between two dimensions and their
 * relative sizes.
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
import { ResponsiveMarimekko } from '@nivo/marimekko';

interface NivoMarimekkoPluginMetadata {
  type: 'nivo_marimekko';
  fieldName: string;
}

interface NivoMarimekkoOptions {
  /** Color scheme for the chart */
  colorScheme?: string;
  /** Enable/disable chart legends */
  enableLegends?: boolean;
  /** Layout direction */
  layout?: 'horizontal' | 'vertical';
  /** Offset type for stacking */
  offset?: 'none' | 'expand';
  /** Inner padding between bars (0-1) */
  innerPadding?: number;
  /** Outer padding (0-1) */
  outerPadding?: number;
}

type NivoMarimekkoPluginInstance =
  DOMRenderPluginInstance<NivoMarimekkoPluginMetadata>;

/**
 * Factory for creating Nivo Marimekko Chart plugin instances.
 *
 * Marimekko charts are ideal for showing:
 * - Market share by product and region
 * - Budget allocation across categories and departments
 * - Sales distribution by product line and customer segment
 *
 * The chart expects nested data where:
 * - The outer level represents one dimension (e.g., regions)
 * - The inner level represents another dimension (e.g., products)
 * - Values represent the measures (e.g., sales, market share)
 *
 * Usage in Malloy:
 * ```malloy
 * query: sales -> {
 *   nest: by_region is {
 *     group_by: region
 *     nest: by_product is {
 *       group_by: product
 *       aggregate: revenue is sum(amount)
 *     }
 *   } # nivo_marimekko
 * }
 * ```
 */
export const NivoMarimekkoPluginFactory: RenderPluginFactory<NivoMarimekkoPluginInstance> =
  {
    name: 'nivo_marimekko',

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasNivoMarimekkoTag = fieldTag.has('nivo_marimekko');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasNivoMarimekkoTag && !isRepeatedRecord) {
        throw new Error(
          'Nivo Marimekko plugin requires a repeated record field. ' +
            `Field "${field.name}" is of type ${FieldType[fieldType]}.`
        );
      }

      return hasNivoMarimekkoTag && isRepeatedRecord;
    },

    create: (
      field: Field,
      pluginOptions?: unknown
    ): NivoMarimekkoPluginInstance => {
      const options = (pluginOptions as NivoMarimekkoOptions) || {};
      let reactRoot: ReactDOM.Root | null = null;

      return {
        name: 'nivo_marimekko',
        field,
        renderMode: 'dom',
        sizingStrategy: 'fill',

        renderToDOM: (container: HTMLElement, props: RenderProps): void => {
          if (!props.dataColumn.isRepeatedRecord()) {
            container.innerHTML = `
              <div style="padding: 20px; color: #d32f2f; border: 2px solid #d32f2f; border-radius: 4px;">
                <strong>Error:</strong> Nivo Marimekko Chart requires repeated record data
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

            // For Marimekko charts, we expect:
            // 1. An id field (first field, typically categorical)
            // 2. Nested data with categories and values
            // OR
            // 1. A simple structure with multiple numeric fields

            const idField = childFields[0];
            const dataFields = childFields.filter(f => f.isNumber());

            if (!idField) {
              container.innerHTML = `
                <div style="padding: 20px; color: #d32f2f; border: 2px solid #d32f2f; border-radius: 4px;">
                  <strong>Error:</strong> Marimekko chart requires at least one dimension field
                </div>
              `;
              return;
            }

            // Check if this is nested data (has repeated record fields)
            const nestedField = childFields.find(f => f.isNest());

            let data: any[];

            if (nestedField) {
              // Handle nested structure: outer dimension with inner dimensions
              data = rows.map(row => {
                const idCell = row.column(idField.name);
                const nestedCell = row.column(nestedField.name);

                const item: any = {
                  id: String(idCell.value ?? 'Unknown'),
                };

                if (nestedCell.isRepeatedRecord()) {
                  const nestedRows = nestedCell.rows;
                  const nestedChildren = nestedField.isNest()
                    ? nestedField.children
                    : [];

                  // Extract nested dimensions as properties
                  nestedRows.forEach(nestedRow => {
                    const nestedIdField = nestedChildren.find(f => !f.isNumber());
                    const nestedValueField = nestedChildren.find(f => f.isNumber());

                    if (nestedIdField && nestedValueField) {
                      const key = String(
                        nestedRow.column(nestedIdField.name).value ?? 'Unknown'
                      );
                      const value = Number(
                        nestedRow.column(nestedValueField.name).value ?? 0
                      );
                      item[key] = value;
                    }
                  });
                }

                return item;
              });
            } else {
              // Handle flat structure: id + multiple numeric fields
              data = rows.map(row => {
                const item: any = {
                  id: String(row.column(idField.name).value ?? 'Unknown'),
                };

                dataFields.forEach(field => {
                  const cell = row.column(field.name);
                  item[field.name] = Number(cell.value ?? 0);
                });

                return item;
              });
            }

            // Extract dimensions (all keys except 'id')
            const dimensions = Array.from(
              new Set(
                data.flatMap(item =>
                  Object.keys(item).filter(key => key !== 'id')
                )
              )
            );

            if (dimensions.length === 0) {
              container.innerHTML = `
                <div style="padding: 20px; color: #d32f2f; border: 2px solid #d32f2f; border-radius: 4px;">
                  <strong>Error:</strong> No dimensions found for Marimekko chart
                </div>
              `;
              return;
            }

            // Nivo Marimekko Chart Component
            const NivoMarimekkoChart = () => (
              <div style={{ width: '100%', height: '500px' }}>
                <ResponsiveMarimekko
                  data={data}
                  id="id"
                  value="value"
                  dimensions={dimensions}
                  layout={options.layout ?? 'horizontal'}
                  offset={options.offset ?? 'none'}
                  colors={{ scheme: options.colorScheme || 'nivo' }}
                  borderWidth={1}
                  borderColor={{
                    from: 'color',
                    modifiers: [['darker', 0.2]],
                  }}
                  innerPadding={options.innerPadding ?? 9}
                  outerPadding={options.outerPadding ?? 9}
                  axisTop={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: '',
                    legendOffset: 36,
                  }}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: 'Dimension',
                    legendPosition: 'middle',
                    legendOffset: 36,
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: 'Value',
                    legendPosition: 'middle',
                    legendOffset: -40,
                  }}
                  legends={
                    options.enableLegends !== false
                      ? [
                          {
                            anchor: 'bottom',
                            direction: 'row',
                            justify: false,
                            translateX: 0,
                            translateY: 80,
                            itemsSpacing: 0,
                            itemWidth: 100,
                            itemHeight: 20,
                            itemTextColor: '#999',
                            itemDirection: 'left-to-right',
                            itemOpacity: 1,
                            symbolSize: 20,
                            effects: [
                              {
                                on: 'hover',
                                style: {
                                  itemTextColor: '#000',
                                },
                              },
                            ],
                          },
                        ]
                      : []
                  }
                />
              </div>
            );

            // Render React component
            if (!reactRoot) {
              reactRoot = ReactDOM.createRoot(container);
            }
            reactRoot.render(<NivoMarimekkoChart />);
          } catch (error) {
            console.error('Error rendering Nivo Marimekko Chart:', error);
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

        getMetadata: (): NivoMarimekkoPluginMetadata => ({
          type: 'nivo_marimekko',
          fieldName: field.name,
        }),
      };
    },
  };
