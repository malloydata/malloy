/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLTextRenderer} from './text';
import type {DurationRenderOptions, StyleDefaults} from './data_styles';
import {DurationUnit} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import {formatDuration} from '../util';
import type {Cell, Field} from '../data_tree';

export function getText(
  field: Field,
  value: number,
  options: {
    durationUnit?: string;
  }
): string | null {
  return formatDuration(value, {
    durationUnit: options.durationUnit,
    numFormat: field.tag.text('number'),
    terse: field.tag.has('duration', 'terse'),
  });
}

export class HTMLDurationRenderer extends HTMLTextRenderer {
  constructor(
    document: Document,
    readonly options: DurationRenderOptions
  ) {
    super(document);
  }

  override getText(data: Cell): string | null {
    if (data.isNull()) {
      return null;
    }

    if (!data.isNumber()) {
      throw new Error(
        `Cannot format field ${data.field.name} as a duration unit since its not a number`
      );
    }
    return getText(data.field, data.value, {
      durationUnit: this.options.duration_unit,
    });
  }
}

export class DurationRendererFactory extends RendererFactory<DurationRenderOptions> {
  public static readonly instance = new DurationRendererFactory();

  constructor() {
    super();
    this.addExtractor((options, value) => {
      options.duration_unit =
        (value?.text() as DurationUnit) ?? DurationUnit.Seconds;
    }, this.rendererName);
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    options: DurationRenderOptions
  ): Renderer {
    return new HTMLDurationRenderer(document, options);
  }

  get rendererName() {
    return 'duration';
  }
}
