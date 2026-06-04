/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLListRenderer} from './list';
import type {RecordOrRepeatedRecordField, Field} from '../data_tree';

export class HTMLListDetailRenderer extends HTMLListRenderer {
  getDetailField(explore: RecordOrRepeatedRecordField): Field | undefined {
    // Get the second non-hidden field as the description
    return explore.fields.filter(field => !field.isHidden())[1];
  }
}
