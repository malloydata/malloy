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
  DurationRenderOptions,
  DurationUnit,
  StyleDefaults,
} from '../data_styles';
import {RendererOptions} from '../renderer_types';
import {Renderer} from '../renderer';
import {RendererFactory} from '../renderer_factory';

export class HTMLDurationRenderer extends HTMLTextRenderer {
  constructor(
    document: Document,
    readonly options: DurationRenderOptions
  ) {
    super(document);
  }

  // Map of unit to how many units of the make up the following time unit.
  static multiplierMap = new Map<DurationUnit, number>([
    [DurationUnit.Nanoseconds, 1000],
    [DurationUnit.Microseconds, 1000],
    [DurationUnit.Milliseconds, 1000],
    [DurationUnit.Seconds, 60],
    [DurationUnit.Minutes, 60],
    [DurationUnit.Hours, 24],
    [DurationUnit.Days, Number.MAX_VALUE],
  ]);

  override getText(data: DataColumn): string | null {
    if (data.isNull()) {
      return null;
    }

    if (!data.isNumber()) {
      throw new Error(
        `Cannot format field ${data.field.name} as a duration unit since its not a number`
      );
    }

    const targetUnit = this.options.duration_unit ?? DurationUnit.Seconds;
    let currentDuration = data.number.value;
    let currentUnitValue = 0;
    let durationParts: string[] = [];
    let foundUnit = false;

    for (const [unit, multiplier] of HTMLDurationRenderer.multiplierMap) {
      if (unit === targetUnit) {
        foundUnit = true;
      }

      if (!foundUnit) {
        continue;
      }

      currentUnitValue = currentDuration % multiplier;
      currentDuration = Math.floor((currentDuration /= multiplier));

      if (currentUnitValue > 0) {
        durationParts = [
          this.formatTimeUnit(currentUnitValue, unit),
          ...durationParts,
        ];
      }

      if (currentDuration === 0) {
        break;
      }
    }

    if (durationParts.length > 0) {
      return durationParts.slice(0, 2).join(' ');
    }

    return this.formatTimeUnit(0, targetUnit);
  }

  formatTimeUnit(value: number, unit: DurationUnit) {
    let unitString = unit.toString();
    if (value === 1) {
      unitString = unitString.substring(0, unitString.length - 1);
    }
    return `${value} ${unitString}`;
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
    _field: Field | Explore,
    options: DurationRenderOptions
  ): Renderer {
    return new HTMLDurationRenderer(document, options);
  }

  get rendererName() {
    return 'duration';
  }
}
