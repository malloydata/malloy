/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  RenderPluginFactory,
  RenderProps,
  DOMRenderPluginInstance,
  RendererValidationSpec,
} from '@/api/plugin-types';
import {type Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import * as lite from 'vega-lite';
import * as vega from 'vega';
import {generateScatterChartSpec} from './generate-scatter_chart-spec';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import type {RenderLogCollector} from '@/component/render-log-collector';

export const ScatterChartPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'scatter_chart',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'scatter_chart',
      ownedPaths: [['scatter_chart']],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('scatter_chart');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasTag && !isRepeatedRecord) {
        throw new Error(
          'Malloy Scatter Chart: field is a scatter chart, but is not a repeated record. Try moving the tag to the line above the query, run, nest, or view declaration.'
        );
      }

      return hasTag && isRepeatedRecord;
    },

    create: (field: Field): DOMRenderPluginInstance => {
      let vegaConfigOverride: Record<string, unknown> = {};
      let logCollector: RenderLogCollector | undefined;

      return {
        name: 'scatter_chart',
        field,
        renderMode: 'dom',
        sizingStrategy: 'fixed',

        beforeRender: (
          _metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          vegaConfigOverride =
            options.getVegaConfigOverride?.('scatter_chart') ?? {};
          logCollector = options.renderFieldMetadata.logCollector;
        },

        renderToDOM: (container: HTMLElement, props: RenderProps): void => {
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Scatter Chart: data column is not a repeated record'
            );
          }

          const spec = generateScatterChartSpec(
            props.dataColumn,
            field,
            vegaConfigOverride
          );

          const vegaSpec = lite.compile(spec).spec;
          const view = new vega.View(vega.parse(vegaSpec), {
            renderer: 'none',
          });
          view.logger().level(-1);
          view
            .toSVG()
            .then(svg => {
              container.innerHTML = svg;
            })
            .catch(e => {
              logCollector?.error(`Scatter chart render error: ${e}`);
            });
        },

        getMetadata: () => ({type: 'scatter_chart', field}),
      };
    },
  };
