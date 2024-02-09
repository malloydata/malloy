/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import padStart from 'lodash/padStart';

/**
 * Left pads numeric values wth zero
 */
export const zeroPad = (length: number) => (value: number) =>
  padStart(String(value), length, '0');

export const zeroPad2 = zeroPad(2);
export const zeroPad4 = zeroPad(4);
