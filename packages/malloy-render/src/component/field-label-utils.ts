/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Convert snake_case to Title Case
 */
export function snakeToTitleCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get the display label for a field
 * Priority: # label annotation > snake_case conversion of field name
 */
export function getFieldLabel(field: {
  name: string;
  tag: {text: (...args: string[]) => string | undefined};
}): string {
  return field.tag.text('label') || snakeToTitleCase(field.name);
}
