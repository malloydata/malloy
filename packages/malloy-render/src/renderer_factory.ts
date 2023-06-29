import {Explore, Field, MalloyTagProperties} from '@malloydata/malloy';
import {Renderer} from './renderer';
import {DataRenderOptions, RenderDef, StyleDefaults} from './data_styles';
import {RendererOptions} from './renderer_types';

export abstract class RendererFactory<T extends DataRenderOptions> {
  activates(_field: Field | Explore): boolean {
    // Does not activate by default.
    return false;
  }

  isValidMatch(_field: Field | Explore): boolean {
    return true;
  }

  matches(renderDef: RenderDef): boolean {
    return renderDef.renderer === this.rendererName;
  }

  parseTagParameters(_tags: MalloyTagProperties): T | undefined {
    return undefined;
  }

  abstract get rendererName(): string | undefined;
  abstract create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    field: Field | Explore,
    renderOptions: T,
    timezone?: string
  ): Renderer;
}
