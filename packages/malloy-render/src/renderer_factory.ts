import {Explore, Field, MalloyTagProperties} from '@malloydata/malloy';
import {Renderer} from './renderer';
import {DataRenderOptions, RenderDef, StyleDefaults} from './data_styles';
import {RendererOptions} from './renderer_types';

type TagPropertyExtractor<T extends DataRenderOptions> = (
  options: T,
  extractedValue: string
) => void;

export abstract class RendererFactory<T extends DataRenderOptions> {
  readonly tagOptionExtractors: Record<string, TagPropertyExtractor<T>> = {};

  protected addExtractor(
    extractor: TagPropertyExtractor<T>,
    ...tags: string[]
  ) {
    for (const index in tags) {
      this.tagOptionExtractors[tags[index]] = extractor;
    }
  }

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

  parseTagParameters(tagProperties: MalloyTagProperties) {
    const options = {} as T;
    for (const tag in this.tagOptionExtractors) {
      if (
        tagProperties[tag] !== undefined &&
        typeof tagProperties[tag] === 'string'
      )
        this.tagOptionExtractors[tag](options, tagProperties[tag] as string);
    }

    return options;
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
