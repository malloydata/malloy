import {Explore, Field, Tag} from '@malloydata/malloy';
import {Renderer} from './renderer';
import {DataRenderOptions, RenderDef, StyleDefaults} from './data_styles';
import {RendererOptions} from './renderer_types';

type TagPropertyExtractor<T extends DataRenderOptions> = (
  options: T,
  tagObj: Tag | undefined
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

  parseTagParameters(tags: Tag) {
    const options = {} as T;
    for (const tagName in this.tagOptionExtractors) {
      const tagValue = tags.tag(tagName);
      if (tagValue) {
        this.tagOptionExtractors[tagName](options, tagValue);
      }
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
