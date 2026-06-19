/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLTextRenderer} from './text';
import type {
  DataVolumeRenderOptions,
  NumberRenderOptions,
  StyleDefaults,
} from './data_styles';
import {DataVolumeUnit} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

export class HTMLDataVolumeRenderer extends HTMLTextRenderer {
  constructor(
    document: Document,
    readonly options: DataVolumeRenderOptions
  ) {
    super(document);
  }

  private static kbMultiplier = 1024;
  private static mbMultiplier = this.kbMultiplier * this.kbMultiplier;
  private static gbMultiplier = this.mbMultiplier * this.kbMultiplier;
  private static tbMultiplier = this.gbMultiplier * this.kbMultiplier;

  override getText(data: Cell): string | null {
    if (data.isNull()) {
      return null;
    }

    if (!data.isNumber()) {
      throw new Error(
        'Cannot format field as data volume since it is not a number'
      );
    }

    let data_volume = data.value;
    let unit = 'Bytes';
    switch (this.options.data_volume_unit) {
      case DataVolumeUnit.Bytes:
        // Do nothing.
        break;
      case DataVolumeUnit.Kilobytes:
        data_volume = data_volume / HTMLDataVolumeRenderer.kbMultiplier;
        unit = 'KB';
        break;
      case DataVolumeUnit.Megabytes:
        data_volume = data_volume / HTMLDataVolumeRenderer.mbMultiplier;
        unit = 'MB';
        break;
      case DataVolumeUnit.Gigabytes:
        data_volume = data_volume / HTMLDataVolumeRenderer.gbMultiplier;
        unit = 'GB';
        break;
      case DataVolumeUnit.Terabytes:
        data_volume = data_volume / HTMLDataVolumeRenderer.tbMultiplier;
        unit = 'TB';
        break;
    }

    return data_volume === null
      ? data_volume
      : `${data_volume.toLocaleString()} ${unit}`;
  }
}

export class DataVolumeRendererFactory extends RendererFactory<DataVolumeRenderOptions> {
  public static readonly instance = new DataVolumeRendererFactory();

  constructor() {
    super();
    this.addExtractor((options, tag) => {
      options.data_volume_unit =
        (tag?.text() as DataVolumeUnit) ?? DataVolumeUnit.Bytes;
    }, this.rendererName);
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    options: NumberRenderOptions
  ): Renderer {
    return new HTMLDataVolumeRenderer(document, options);
  }

  get rendererName() {
    return 'data_volume';
  }
}
