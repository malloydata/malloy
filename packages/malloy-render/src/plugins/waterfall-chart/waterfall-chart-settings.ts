import type {JSONSchemaObject} from '@/api/json-schema-types';

export interface WaterfallChartSettings extends Record<string, unknown> {
  startField: string;
  endField: string;
  xField: string;
  yField: string;
}

export const defaultWaterfallChartSettings: WaterfallChartSettings = {
  startField: '',
  endField: '',
  xField: '',
  yField: '',
};

export interface IWaterfallChartSettingsSchema extends JSONSchemaObject {
  properties: {
    startField: {type: 'string'};
    endField: {type: 'string'};
    xField: {type: 'string'};
    yField: {type: 'string'};
  };
}

export const waterfallChartSettingsSchema: IWaterfallChartSettingsSchema = {
  title: 'Waterfall Chart Settings',
  type: 'object',
  properties: {
    startField: {type: 'string'},
    endField: {type: 'string'},
    xField: {type: 'string'},
    yField: {type: 'string'},
  },
};
