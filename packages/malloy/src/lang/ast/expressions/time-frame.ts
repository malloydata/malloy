/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TimestampUnit} from '../../../model/malloy_types';
import {isTimestampUnit} from '../../../model/malloy_types';

import {MalloyElement} from '../types/malloy-element';

export class Timeframe extends MalloyElement {
  elementType = 'timeframe';
  readonly text: TimestampUnit;
  constructor(timeframeName: string) {
    super();
    let tf = timeframeName.toLowerCase();
    if (tf.endsWith('s')) {
      tf = tf.slice(0, -1);
    }
    this.text = isTimestampUnit(tf) ? tf : 'second';
  }
}
