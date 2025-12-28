import {createEffect, createMemo, onCleanup} from 'solid-js';
import {compile} from 'vega-lite';
import {parse, View} from 'vega';
import type {TopLevelSpec} from 'vega-lite';
import type {RepeatedRecordCell, Field, RecordCell} from '@/data_tree';
import type {SparklineSettings, SparklineType, SparklineSize} from './sparkline-settings';

// Global tooltip element for sparklines
let tooltipEl: HTMLDivElement | null = null;

/**
 * Get or create the tooltip element
 */
function getTooltipElement(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'malloy-sparkline-vega-tooltip';
    tooltipEl.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 100000;
      background: #1f2937;
      color: #f9fafb;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      opacity: 0;
      transition: opacity 0.1s ease-in-out;
      white-space: nowrap;
    `;
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

/**
 * Create a Vega tooltip handler for sparklines with optional formatting
 */
function createTooltipHandler(options?: {yFieldName?: string; yPrefix?: string; ySuffix?: string}) {
  return function tooltipHandler(
    handler: unknown,
    event: MouseEvent,
    item: {datum?: Record<string, unknown>} | null,
    value: Record<string, unknown> | string | null
  ) {
    const el = getTooltipElement();

    if (!value || !item?.datum) {
      el.style.opacity = '0';
      return;
    }

    // Format tooltip content
    const data = typeof value === 'string' ? JSON.parse(value) : value;
    const entries = Object.entries(data);

    if (entries.length === 0) {
      el.style.opacity = '0';
      return;
    }

    // Build tooltip HTML with optional formatting for y values
    const html = entries.map(([key, val]) => {
      let formattedVal: string;
      const isYField = options?.yFieldName && key === options.yFieldName;
      const prefix = isYField && options?.yPrefix ? options.yPrefix : '';
      const suffix = isYField && options?.ySuffix ? options.ySuffix : '';

      if (typeof val === 'number') {
        formattedVal = `${prefix}${val.toLocaleString(undefined, {maximumFractionDigits: 2})}${suffix}`;
      } else if (typeof val === 'string' && isYField) {
        // Value is already formatted as string by Vega - add prefix/suffix
        formattedVal = `${prefix}${val}${suffix}`;
      } else {
        formattedVal = String(val);
      }
      return `<div style="margin: 2px 0;"><strong>${key}:</strong> ${formattedVal}</div>`;
    }).join('');

    el.innerHTML = html;
    el.style.opacity = '1';
    el.style.left = `${event.clientX + 10}px`;
    el.style.top = `${event.clientY - 10}px`;
  };
}

// Default tooltip handler (no formatting)
const defaultTooltipHandler = createTooltipHandler();

/**
 * Props for the SparklineComponent when used with Malloy data
 */
export interface SparklineComponentProps {
  /** The data cell containing the nested rows */
  dataColumn: RepeatedRecordCell;
  /** Field metadata */
  field: Field;
  /** Plugin settings */
  settings: SparklineSettings;
}

/**
 * Props for using SparklineComponent with pre-processed data
 * This allows embedding in tables, big-value cards, etc.
 */
export interface SparklineEmbedProps {
  /** Pre-processed data points */
  data: Array<{x: unknown; y: number}>;
  /** X field name for tooltip */
  xFieldName: string;
  /** Y field name for tooltip */
  yFieldName: string;
  /** Type of sparkline */
  type?: SparklineType;
  /** Size preset or custom dimensions */
  size?: SparklineSize | {width: number; height: number};
  /** Optional prefix for y values (e.g., "$" for currency) */
  yPrefix?: string;
  /** Optional suffix for y values (e.g., "%" for percentage) */
  ySuffix?: string;
}

/**
 * Get dimensions from size setting
 */
function getDimensions(size?: SparklineSize | {width: number; height: number}): {
  width: number;
  height: number;
} {
  if (typeof size === 'object' && 'width' in size) {
    return size;
  }

  // Preset sizes
  switch (size) {
    case 'xs':
      // For table cells - very compact
      return {width: 60, height: 16};
    case 'sm':
      // Small - for big-value cards (sm size)
      return {width: 80, height: 20};
    case 'md':
      // Medium - default for big-value cards
      return {width: 100, height: 24};
    case 'lg':
      // Large - standalone or big-value (lg size)
      return {width: 150, height: 32};
    case 'xl':
      // Extra large - standalone sparkline view
      return {width: 200, height: 40};
    default:
      return {width: 100, height: 24};
  }
}

/**
 * Get Vega-Lite data type from field
 */
function getDataType(
  field: Field
): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
  if (field.isTime()) {
    return 'temporal';
  } else if (field.isString()) {
    return 'nominal';
  } else if (field.isNumber()) {
    return 'quantitative';
  }
  return 'nominal';
}

/**
 * Infer data type from value
 */
function inferDataType(
  value: unknown
): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
  if (value instanceof Date) {
    return 'temporal';
  } else if (typeof value === 'number') {
    return 'quantitative';
  } else if (typeof value === 'string') {
    // Check if it's a date string
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) {
      return 'temporal';
    }
    return 'nominal';
  }
  return 'nominal';
}

/**
 * Extract data value from a cell
 */
function getDataValue(cell: {
  value: unknown;
  isNull: () => boolean;
  isTime: () => boolean;
  isNumber: () => boolean;
  isString: () => boolean;
}): Date | string | number | null {
  if (cell.isNull()) {
    return null;
  } else if (cell.isTime()) {
    return cell.value as Date;
  } else if (cell.isNumber()) {
    return cell.value as number;
  } else if (cell.isString()) {
    return cell.value as string;
  }
  return String(cell.value);
}

/**
 * Map Malloy data rows to Vega-compatible data format
 */
function mapMalloyData(
  rows: RecordCell[],
  xFieldName: string,
  yFieldName: string
): Record<string, unknown>[] {
  return rows.map(row => {
    const result: Record<string, unknown> = {};
    const xCell = row.column(xFieldName);
    const yCell = row.column(yFieldName);

    if (xCell) {
      result[xFieldName] = getDataValue(xCell);
    }
    if (yCell) {
      result[yFieldName] = getDataValue(yCell);
    }

    return result;
  });
}

/**
 * Get mark type for Vega-Lite based on sparkline type
 */
function getMarkType(type: SparklineType): 'line' | 'area' | 'bar' {
  switch (type) {
    case 'area':
      return 'area';
    case 'bar':
      return 'bar';
    default:
      return 'line';
  }
}

/**
 * Generate Vega-Lite spec for sparkline with interactive tooltip
 */
function generateVegaLiteSpec(
  data: Record<string, unknown>[],
  xFieldName: string,
  yFieldName: string,
  xType: 'temporal' | 'ordinal' | 'quantitative' | 'nominal',
  yType: 'temporal' | 'ordinal' | 'quantitative' | 'nominal',
  settings: {type: SparklineType; width: number; height: number}
): TopLevelSpec {
  const markType = getMarkType(settings.type);

  // Use layered spec for line/area to add invisible points for hover
  if (markType === 'line' || markType === 'area') {
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: settings.width,
      height: settings.height,
      padding: 2,
      autosize: {type: 'fit', contains: 'padding'},
      data: {values: data},
      config: {
        view: {stroke: 'transparent'},
        axis: {grid: false, domain: false, ticks: false, labels: false, title: null},
      },
      background: 'transparent',
      layer: [
        // Base line/area layer
        {
          mark: {
            type: markType,
            color: '#4285F4',
            ...(markType === 'area' ? {line: true, opacity: 0.3} : {}),
            ...(markType === 'line' ? {strokeWidth: 1.5} : {}),
          },
          encoding: {
            x: {field: xFieldName, type: xType, axis: null, scale: {zero: false}},
            y: {field: yFieldName, type: yType, axis: null, scale: {zero: false}},
          },
        },
        // Point layer for hover - only shows the hovered point
        {
          mark: {type: 'circle', size: 60},
          params: [{
            name: 'hover',
            select: {type: 'point', on: 'pointerover', nearest: true, clear: 'pointerout'},
          }],
          encoding: {
            x: {field: xFieldName, type: xType, axis: null, scale: {zero: false}},
            y: {field: yFieldName, type: yType, axis: null, scale: {zero: false}},
            opacity: {condition: {param: 'hover', empty: false, value: 1}, value: 0},
            tooltip: [
              {field: xFieldName, type: xType},
              {field: yFieldName, type: yType, format: ',.2f'},
            ],
          },
        },
      ],
    } as TopLevelSpec;
  }

  // Simple spec for bar charts
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: settings.width,
    height: settings.height,
    padding: 2,
    autosize: {type: 'fit', contains: 'padding'},
    data: {values: data},
    config: {
      view: {stroke: 'transparent'},
      axis: {grid: false, domain: false, ticks: false, labels: false, title: null},
    },
    background: 'transparent',
    mark: {type: 'bar', color: '#4285F4', cornerRadius: 1},
    encoding: {
      x: {field: xFieldName, type: xType, axis: null, scale: {zero: false}},
      y: {field: yFieldName, type: yType, axis: null, scale: {zero: false}},
      tooltip: [
        {field: xFieldName, type: xType},
        {field: yFieldName, type: yType, format: ',.2f'},
      ],
    },
  } as TopLevelSpec;
}

/**
 * Extract format prefix/suffix from a field's tags (for sparkline y-values)
 */
function getFieldFormat(field: Field): {yPrefix?: string; ySuffix?: string} {
  const tag = field.tag;
  if (tag.has('currency')) {
    const currencyType = tag.text('currency');
    return {
      yPrefix:
        currencyType === 'EUR'
          ? '€'
          : currencyType === 'GBP'
            ? '£'
            : '$',
    };
  } else if (tag.has('percent')) {
    return {ySuffix: '%'};
  }
  return {};
}

/**
 * Sparkline component using Vega-Lite
 * Can be used standalone or embedded in tables/big-value cards
 */
export function SparklineComponent(props: SparklineComponentProps) {
  let containerRef: HTMLDivElement | undefined;
  let viewInstance: View | null = null;

  const vegaSpec = createMemo(() => {
    const fields = props.dataColumn.field.fields;
    if (fields.length < 2) {
      throw new Error('Sparkline requires at least 2 fields (x and y)');
    }

    // Use field metadata to identify dimension (x) vs measure (y)
    // This ensures correct axis assignment regardless of query clause order
    const xField = fields.find(f => f.wasDimension());
    const yField = fields.find(f => f.wasCalculation());

    if (!xField || !yField) {
      throw new Error('Sparkline requires a dimension field (x) and measure field (y)');
    }

    const data = mapMalloyData(props.dataColumn.rows, xField.name, yField.name);
    const dimensions = getDimensions(props.settings.size);

    const vlSpec = generateVegaLiteSpec(
      data,
      xField.name,
      yField.name,
      getDataType(xField),
      getDataType(yField),
      {type: props.settings.type, ...dimensions}
    );

    const compiled = compile(vlSpec);
    return compiled.spec;
  });

  // Create and manage Vega view with tooltip
  createEffect(() => {
    if (!containerRef) return;

    // Clean up previous view
    if (viewInstance) {
      viewInstance.finalize();
      viewInstance = null;
    }

    // Create tooltip handler with format options from the y-field's tags
    const fields = props.dataColumn.field.fields;
    let handler = defaultTooltipHandler;
    if (fields.length >= 2) {
      const yField = fields[1];
      const format = getFieldFormat(yField);
      if (format.yPrefix || format.ySuffix) {
        handler = createTooltipHandler({
          yFieldName: yField.name,
          yPrefix: format.yPrefix,
          ySuffix: format.ySuffix,
        });
      }
    }

    const spec = vegaSpec();
    const runtime = parse(spec);
    viewInstance = new View(runtime)
      .initialize(containerRef)
      .renderer('svg')
      .hover()
      .tooltip(handler)
      .run();
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (viewInstance) {
      viewInstance.finalize();
      viewInstance = null;
    }
  });

  return <div ref={containerRef} class="malloy-sparkline-container" />;
}

/**
 * Embeddable sparkline component for use in tables, big-value cards, etc.
 * Accepts pre-processed data instead of Malloy cells
 */
export function SparklineEmbed(props: SparklineEmbedProps) {
  let containerRef: HTMLDivElement | undefined;
  let viewInstance: View | null = null;

  const vegaSpec = createMemo(() => {
    const data = props.data.map(d => ({
      [props.xFieldName]: d.x,
      [props.yFieldName]: d.y,
    }));

    // Infer x type from first data point
    const xType =
      props.data.length > 0 ? inferDataType(props.data[0].x) : 'nominal';

    const dimensions = getDimensions(props.size);

    const vlSpec = generateVegaLiteSpec(
      data,
      props.xFieldName,
      props.yFieldName,
      xType,
      'quantitative',
      {type: props.type ?? 'line', ...dimensions}
    );

    const compiled = compile(vlSpec);
    return compiled.spec;
  });

  // Create tooltip handler with format options
  const tooltipHandler = createTooltipHandler({
    yFieldName: props.yFieldName,
    yPrefix: props.yPrefix,
    ySuffix: props.ySuffix,
  });

  // Create and manage Vega view with tooltip
  createEffect(() => {
    if (!containerRef) return;

    // Clean up previous view
    if (viewInstance) {
      viewInstance.finalize();
      viewInstance = null;
    }

    const spec = vegaSpec();
    const runtime = parse(spec);
    viewInstance = new View(runtime)
      .initialize(containerRef)
      .renderer('svg')
      .hover()
      .tooltip(tooltipHandler)
      .run();
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (viewInstance) {
      viewInstance.finalize();
      viewInstance = null;
    }
  });

  return <div ref={containerRef} class="malloy-sparkline-container" />;
}
