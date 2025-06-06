import type {Tag} from '@malloydata/malloy-tag';
import type {Field, NestField} from './fields';
import type {NestCell} from './cells';
import type {FieldType} from './types';

export type RenderPluginInstance = {
  // TODO duplication of name in multiple places...
  name: string;
  processData(field: NestField, cell: NestCell): void;
};

export type RenderPlugin<
  T extends RenderPluginInstance = RenderPluginInstance,
> = {
  name: string;
  matches: (fieldTag: Tag, fieldType: FieldType) => boolean;
  plugin: RenderPluginFactory<T>;
};

export type RenderPluginFactory<T extends RenderPluginInstance> = (
  field: Field
) => T;
