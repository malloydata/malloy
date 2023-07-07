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

import {DataColumn, Explore, Field} from '@malloydata/malloy';
import {HTMLTextRenderer} from './text';
import {
  DataVolumeRenderOptions,
  DataVolumeUnit,
  NumberRenderOptions,
  StyleDefaults,
} from '../data_styles';
import {RendererOptions} from '../renderer_types';
import {Renderer} from '../renderer';
import {RendererFactory} from '../renderer_factory';

export class HTMLDataVolumeRenderer extends HTMLTextRenderer {
  constructor(document: Document, readonly options: DataVolumeRenderOptions) {
    super(document);
  }

  private static kbMultiplier = 1024;
  private static mbMultiplier = this.kbMultiplier * this.kbMultiplier;
  private static gbMultiplier = this.mbMultiplier * this.kbMultiplier;
  private static tbMultiplier = this.gbMultiplier * this.kbMultiplier;

  override getText(data: DataColumn): string | null {
    if (data.isNull()) {
      return null;
    }

    if (!data.isNumber()) {
      throw new Error(
        `Cannot format field ${data.field.name} as data volume since its not a number`
      );
    }

    let data_volume = data.number.value;
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
    this.addExtractor((options, value) => {
      options.data_volume_unit =
        (value as DataVolumeUnit) ?? DataVolumeUnit.Bytes;
    }, this.rendererName);
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field | Explore,
    options: NumberRenderOptions
  ): Renderer {
    return new HTMLDataVolumeRenderer(document, options);
  }

  get rendererName() {
    return 'data_volume';
  }
}
