/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as lite from 'vega-lite';
import {DataColumn, Explore, Field} from '@malloydata/malloy';
import {HTMLChartRenderer} from './chart';
import cloneDeep from 'lodash/cloneDeep';
import {getColorScale} from './utils';
import {StyleDefaults, VegaRenderOptions} from '../data_styles';
import {RendererOptions} from '../renderer_types';
import {RendererFactory} from '../renderer_factory';
import {Renderer} from '../renderer';

type DataContainer = Array<unknown> | Record<string, unknown>;

export const DEFAULT_SPEC: Partial<lite.TopLevelSpec> = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  config: {
    params: [
      {
        name: 'defaultFont',
        value: "var(--malloy-font-family, 'Roboto')",
      },
      {name: 'titleColor', value: 'var(--malloy-title-color, #505050)'},
      {name: 'labelColor', value: 'var(--malloy-label-color, #505050)'},
    ],
    background: undefined,
    color: {expr: 'titleColor'},
    header: {
      labelFont: {expr: 'defaultFont'},
      titleFont: {expr: 'defaultFont'},
      titleFontWeight: 500,
    },
    text: {
      font: {expr: 'defaultFont'},
      color: {expr: 'labelColor'},
    },
    mark: {
      font: {expr: 'defaultFont'},
      color: {expr: 'labelColor'},
    },
    title: {
      font: {expr: 'defaultFont'},
      subtitleFont: {expr: 'defaultFont'},
      fontWeight: 500,
    },
    axis: {
      labelColor: {expr: 'labelColor'},
      labelFont: {expr: 'defaultFont'},
      titleFont: {expr: 'defaultFont'},
      titleFontWeight: 500,
      titleColor: {expr: 'titleColor'},
      titleFontSize: 12,
    },
    legend: {
      titleFontWeight: 500,
      titleColor: {expr: 'titleColor'},
      titleFontSize: 12,
      labelColor: {expr: 'labelColor'},
      labelFont: {expr: 'defaultFont'},
      titleFont: {expr: 'defaultFont'},
    },
  },
};

const sizeSmall = {
  height: 80,
  width: 150,
};

const sizeSmallWidth = {
  width: 150,
};

const sizeSmallHeightStep = {
  height: {step: 13},
};

const sizeSmallStep = {...sizeSmallWidth, ...sizeSmallHeightStep};
const sizeMediumStep = {...sizeSmallWidth};

const sizeMedium = {
  height: 150,
  width: 200,
};

const sizeLarge = {
  // height: 350,
  // width: 500,
};

// bar with text in the bars.
const bar_SM: lite.TopLevelSpec = {
  config: {...DEFAULT_SPEC.config},
  encoding: {
    y: {field: '#{1}', type: 'nominal', axis: null, sort: null},
  },
  layer: [
    {
      mark: {type: 'bar', color: '#aec7e8'},
      encoding: {
        x: {
          field: '#{2}',
          type: 'quantitative',
          sort: null,
        },
        color: {value: '#4285F4'},
      },
    },
    {
      mark: {type: 'text', align: 'left', x: 5},
      encoding: {
        text: {field: '#{1}'},
      },
    },
  ],
};

const bar_SM_large: lite.TopLevelSpec = {
  ...DEFAULT_SPEC,
  mark: 'bar',
  data: [],
  encoding: {
    x: {field: '#{1}', type: 'nominal', sort: null},
    y: {field: '#{2}', type: 'quantitative', sort: null},
    color: {value: '#4285F4'},
  },
};

const bar_SMM_large = {
  ...bar_SM_large,
  encoding: {
    ...bar_SM_large.encoding,
    color: {
      field: '#{3}',
      type: 'quantitative',
      scale: getColorScale('quantitative', true, true),
    },
  },
} as lite.TopLevelSpec;

const bar_SMS_large = {
  ...bar_SM_large,
  encoding: {
    ...bar_SM_large.encoding,
    color: {
      field: '#{3}',
      scale: getColorScale('nominal', true, true),
    },
  },
} as lite.TopLevelSpec;

const bar_SMS = {
  ...bar_SM,
  layer: [
    {
      ...bar_SM.layer[0],
      encoding: {
        ...bar_SM.layer[0].encoding,
        color: {
          field: '#{3}',
          scale: getColorScale('nominal', true, true),
        },
      },
    },
    bar_SM.layer[1],
  ],
} as lite.TopLevelSpec;

const bar_SMM = {
  ...bar_SM,
  layer: [
    {
      ...bar_SM.layer[0],
      encoding: {
        ...bar_SM.layer[0].encoding,
        color: {
          field: '#{3}',
          type: 'quantitative',
          scale: getColorScale('quantitative', true, true),
        },
      },
    },
    bar_SM.layer[1],
  ],
} as lite.TopLevelSpec;

// simple column chart
const bar_NM: lite.TopLevelSpec = {
  ...DEFAULT_SPEC,
  mark: 'bar',
  data: [],
  encoding: {
    x: {field: '#{1}', type: 'nominal', sort: null},
    y: {field: '#{2}', type: 'quantitative', sort: null},
    color: {value: '#4285F4'},
  },
};

const bar_NMS: lite.TopLevelSpec = {
  ...bar_NM,
  encoding: {
    ...bar_NM.encoding,
    color: {
      field: '#{3}',
      type: 'nominal',
      scale: getColorScale('nominal', true),
    },
  },
};

const bar_NMM: lite.TopLevelSpec = {
  ...bar_NM,
  encoding: {
    ...bar_NM.encoding,
    color: {
      field: '#{3}',
      type: 'quantitative',
      scale: getColorScale('quantitative', true),
    },
  },
};

export const vegaSpecs: Record<string, lite.TopLevelSpec> = {
  bar_SM,
  'bar_SM_small': {...bar_SM, ...sizeSmallStep},
  'bar_SM_medium': {...bar_SM, ...sizeMediumStep}, // just use the default runs long
  bar_SM_large,

  bar_SMS,
  'bar_SMS_small': {...bar_SMS, ...sizeSmallStep},
  'bar_SMS_medium': {...bar_SMS, ...sizeMediumStep},
  bar_SMS_large,

  bar_SMM,
  'bar_SMM_small': {...bar_SMM, ...sizeSmallStep},
  'bar_SMM_medium': {...bar_SMM, ...sizeMediumStep},
  bar_SMM_large,

  bar_NM,
  'bar_NM_small': {...bar_NM, ...sizeSmall},
  'bar_NM_medium': {...bar_NM, ...sizeMedium}, // just use the default runs long
  'bar_NM_large': {...bar_NM},

  bar_NMS,
  'bar_NMS_small': {...bar_NMS, ...sizeSmall},
  'bar_NMS_medium': {...bar_NMS, ...sizeMedium},
  'bar_NMS_large': {...bar_NMS, ...sizeLarge},

  bar_NMM,
  'bar_NMM_small': {...bar_NMM, ...sizeSmall},
  'bar_NMM_medium': {...bar_NMM, ...sizeMedium},
  'bar_NMM_large': {...bar_NMM, ...sizeLarge},

  'bar_SSMMM': {
    ...DEFAULT_SPEC,
    repeat: ['#{3}', '#{4}', '#{5}'],
    spec: {
      description: 'A simple bar chart with embedded data.',
      encoding: {
        y: {field: '#{1}', type: 'nominal', axis: null, sort: null},
      },
      layer: [
        {
          mark: {
            type: 'bar',
          },
          encoding: {
            x: {
              field: {repeat: 'repeat'},
              type: 'quantitative',
              sort: null,
            },
            color: {
              field: '#{2}',
              scale: getColorScale('nominal', true, true),
            },
          },
        },
        {
          mark: {type: 'text', align: 'left', x: 5},
          encoding: {
            text: {field: '#{1}'},
            detail: {aggregate: 'count'},
          },
        },
      ],
    },
  },
  'bubble_NNM': {
    ...DEFAULT_SPEC,
    data: [],
    mark: 'circle',
    width: 400,
    encoding: {
      y: {
        field: '#{1}',
        type: 'ordinal',
        sort: null,
      },
      x: {
        field: '#{2}',
        type: 'ordinal',
        sort: null,
      },
      size: {
        field: '#{3}',
        type: 'quantitative',
      },
      color: {value: '#4285F4'},
    },
  },
  'heat_NNM': {
    ...DEFAULT_SPEC,
    data: [],
    mark: 'bar',
    width: 400,
    encoding: {
      y: {
        field: '#{1}',
        type: 'ordinal',
        sort: null,
      },
      x: {
        field: '#{2}',
        type: 'ordinal',
        sort: null,
      },
      color: {
        field: '#{3}',
        type: 'quantitative',
        scale: getColorScale('quantitative', false),
      },
    },
  },
  'heat_SNM': {
    ...DEFAULT_SPEC,
    data: [],
    mark: 'bar',
    width: 400,
    encoding: {
      y: {
        field: '#{1}',
        type: 'nominal',
        sort: null,
      },
      x: {
        field: '#{2}',
        type: 'ordinal',
        sort: null,
      },
      color: {
        field: '#{3}',
        type: 'quantitative',
        scale: getColorScale('quantitative', false),
      },
    },
  },
  'stacked_line_STM': {
    ...DEFAULT_SPEC,
    height: 50,
    data: [],
    mark: 'area',
    encoding: {
      x: {
        field: '#{2}',
        type: 'temporal',
        axis: {grid: false},
        sort: null,
      },
      y: {
        field: '#{3}',
        type: 'quantitative',
        axis: {grid: false},
        title: null,
        sort: null,
      },
      color: {
        field: '#{1}',
        type: 'nominal',
        legend: null,
        scale: getColorScale('nominal', false),
      },
      row: {
        field: '#{1}',
        type: 'nominal',
      },
    },
  },
  'grid_line_SSTM': {
    ...DEFAULT_SPEC,
    height: 50,
    data: [],
    mark: 'area',
    encoding: {
      x: {
        field: '#{3}',
        type: 'temporal',
        axis: {grid: false},
        sort: null,
      },
      y: {
        field: '#{4}',
        type: 'quantitative',
        axis: {grid: false},
        title: null,
        sort: null,
      },
      color: {
        field: '#{1}',
        type: 'nominal',
        legend: null,
        scale: getColorScale('nominal', false),
      },
      row: {
        field: '#{1}',
        type: 'nominal',
      },
      column: {
        field: '#{2}',
        type: 'nominal',
      },
    },
  },
};

export function isDataContainer(a: unknown): a is DataContainer {
  return Array.isArray(a) || (a !== null && typeof a === 'object');
}

export class HTMLVegaSpecRenderer extends HTMLChartRenderer {
  spec: lite.TopLevelSpec;

  constructor(
    document: Document,
    styleDefaults: StyleDefaults,
    options: RendererOptions,
    field: Field | Explore,
    vegaRenderOptions: VegaRenderOptions
  ) {
    super(document, styleDefaults, options);
    const spec = vegaRenderOptions.spec;
    if (spec) {
      this.spec = spec;
    } else if (vegaRenderOptions.spec_name) {
      const vegaRenderer = options.dataStyles[vegaRenderOptions.spec_name];
      if (vegaRenderer !== undefined && vegaRenderer.renderer === 'vega') {
        if (vegaRenderer.spec) {
          this.spec = vegaRenderer.spec;
        } else {
          throw new Error(`No spec defined on ${vegaRenderOptions.spec_name}`);
        }
      } else {
        throw new Error(
          `No Vega renderer named ${vegaRenderOptions.spec_name}`
        );
      }
    } else {
      throw new Error(`No top level vega spec defined for ${field.name}`);
    }
  }

  getDataValue(data: DataColumn): Date | string | number | null {
    if (data.isNull()) {
      return null;
    } else if (
      data.isTimestamp() ||
      data.isDate() ||
      data.isNumber() ||
      data.isString()
    ) {
      return data.value;
    } else {
      throw new Error('Invalid field type for vega chart.');
    }
  }

  getDataType(field: Field): 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isAtomicField()) {
      if (field.isDate() || field.isTimestamp() || field.isString()) {
        return 'nominal';
      } else if (field.isNumber()) {
        return 'quantitative';
      }
    }
    throw new Error('Invalid field type for vega chart.');
  }

  translateField(explore: Explore, fieldString: string): string {
    const m = fieldString.match(/#\{(\d+)\}/);
    if (m && m.groups) {
      return explore.intrinsicFields[parseInt(m.groups[1]) - 1].name;
    }
    return fieldString;
  }

  translateFields(node: DataContainer, explore: Explore): void {
    if (Array.isArray(node)) {
      for (const e of node) {
        if (isDataContainer(e)) {
          this.translateFields(e, explore);
        }
      }
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'field' && typeof value === 'string') {
          node[key] = this.translateField(explore, value);
        } else if (key === 'repeat' && Array.isArray(value)) {
          for (const k of value.keys()) {
            const fieldName = value[k];
            if (typeof fieldName === 'string') {
              value[k] = this.translateField(explore, fieldName);
            }
          }
        } else {
          if (isDataContainer(value)) {
            this.translateFields(value, explore);
          }
        }
      }
    }
  }

  // formatData(data: QueryDataRow, metadata: StructDef): VegaData {
  //   const ret: VegaData = [];

  //   for (const row of QueryDataRow) {
  //     forEach){

  //     }
  //   }
  //   return ret;
  // }

  getVegaLiteSpec(data: DataColumn): lite.TopLevelSpec {
    if (data.isNull() || !data.isArray()) {
      throw new Error('Expected struct value not to be null.');
    }

    const newSpec = cloneDeep(this.spec);

    this.translateFields(newSpec as unknown as DataContainer, data.field);
    const rdata = {
      values: this.mapData(data),
    };
    newSpec.data = rdata;

    return newSpec;
  }
}

export class VegaRendererFactory extends RendererFactory<VegaRenderOptions> {
  public static readonly instance = new VegaRendererFactory();

  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    field: Field | Explore,
    options: VegaRenderOptions
  ): Renderer {
    return new HTMLVegaSpecRenderer(
      document,
      styleDefaults,
      rendererOptions,
      field,
      options
    );
  }

  get rendererName() {
    return 'vega';
  }
}
