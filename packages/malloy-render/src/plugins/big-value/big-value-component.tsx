/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {For, Show, createMemo, createSignal} from 'solid-js';
import type {Cell, Field, RecordCell, NestCell, NestField} from '@/data_tree';
import {renderNumberCell} from '@/component/render-numeric-field';
import {NULL_SYMBOL} from '@/util';
import type {
  BigValueSettings,
  BigValueTagConfig,
  BigValueComparisonInfo,
  ComparisonFormat,
  BigValueSize,
} from './big-value-settings';
import {applyRenderer} from '@/component/renderer/apply-renderer';

/**
 * Props for the BigValueComponent.
 *
 * The component receives pre-resolved tag data and never reads
 * tags directly. All tag access happens at setup time in the
 * plugin's create() method.
 */
export interface BigValueComponentProps {
  /** The data cell containing the row(s) */
  dataColumn: NestCell;
  /** Field metadata */
  field: Field;
  /** Plugin settings */
  settings: BigValueSettings;
  /** Pre-resolved tag data for all child fields */
  tagConfig: BigValueTagConfig;
}

/**
 * Information about a sparkline nest (uses existing chart plugins via applyRenderer)
 */
interface SparklineNestInfo {
  nestField: NestField;
  nestCell: NestCell;
}

/**
 * Information about a field to display as a big value card
 */
interface DisplayFieldInfo {
  field: Field;
  cell: Cell | null;
  label: string;
  value: unknown;
  formattedValue: string;
  comparison: BigValueComparisonInfo | null;
  comparisonValue: number | null;
  docText: string | null;
  sparklineNest: SparklineNestInfo | null;
}

/**
 * Delta calculation result
 */
interface DeltaResult {
  display: string;
  isPositive: boolean;
  isNeutral: boolean;
}

/**
 * Calculate the delta between primary and comparison values
 */
function calculateDelta(
  primaryValue: number,
  comparisonValue: number,
  format: ComparisonFormat,
  downIsGood: boolean,
  neutralThreshold: number
): DeltaResult {
  // Handle invalid inputs
  if (
    primaryValue === null ||
    comparisonValue === null ||
    typeof primaryValue !== 'number' ||
    typeof comparisonValue !== 'number' ||
    !isFinite(primaryValue) ||
    !isFinite(comparisonValue)
  ) {
    return {display: '—', isPositive: false, isNeutral: true};
  }

  const delta = primaryValue - comparisonValue;

  if (format === 'ppt') {
    // Percentage point difference
    // Values are assumed to be in decimal form (0.45 for 45%)
    const pptChange = delta * 100;

    // Consider very small changes as neutral
    if (Math.abs(pptChange) < neutralThreshold) {
      return {display: '—', isPositive: false, isNeutral: true};
    }

    const isUp = pptChange > 0;
    const arrow = isUp ? '▲' : '▼';
    const formattedPpt = Math.abs(pptChange).toFixed(1) + ' ppt';

    // Determine if this is "good" based on direction and downIsGood flag
    const isGood = downIsGood ? !isUp : isUp;

    return {
      display: `${arrow} ${formattedPpt}`,
      isPositive: isGood,
      isNeutral: false,
    };
  }

  // Default: percentage change calculation
  // Handle division by zero
  if (comparisonValue === 0) {
    if (primaryValue === 0) {
      return {display: '—', isPositive: false, isNeutral: true};
    }
    // Infinite change
    const isUp = primaryValue > 0;
    const isGood = downIsGood ? !isUp : isUp;
    return {
      display: isUp ? '▲ ∞' : '▼ -∞',
      isPositive: isGood,
      isNeutral: false,
    };
  }

  const percentChange = (delta / Math.abs(comparisonValue)) * 100;

  // Consider very small changes as neutral
  if (Math.abs(percentChange) < neutralThreshold) {
    return {display: '—', isPositive: false, isNeutral: true};
  }

  const isUp = percentChange > 0;
  const arrow = isUp ? '▲' : '▼';
  const formattedPercent = Math.abs(percentChange).toFixed(1) + '%';

  // Determine if this is "good" based on direction and downIsGood flag
  const isGood = downIsGood ? !isUp : isUp;

  return {
    display: `${arrow} ${formattedPercent}`,
    isPositive: isGood,
    isNeutral: false,
  };
}

/**
 * Format a value for display
 * Uses renderNumberCell for proper BigInt support
 */
function formatValue(cell: Cell | null): string {
  if (!cell || cell.value === null || cell.value === undefined) {
    return NULL_SYMBOL;
  }

  // Use renderNumberCell for proper BigInt support
  if (cell.isNumber()) {
    return renderNumberCell(cell);
  }

  return String(cell.value);
}

/**
 * Tooltip icon component with smart positioning
 * Shows tooltip above by default, flips below if not enough space
 */
function TooltipIcon(props: {text: string}) {
  let iconRef: HTMLSpanElement | undefined;
  const [flipped, setFlipped] = createSignal(false);

  const handleMouseEnter = () => {
    if (iconRef) {
      const rect = iconRef.getBoundingClientRect();
      // If less than 100px from top of viewport, flip tooltip below
      setFlipped(rect.top < 100);
    }
  };

  return (
    <span
      class="malloy-big-value-tooltip-icon"
      ref={iconRef}
      onMouseEnter={handleMouseEnter}
    >
      i
      <div
        class="malloy-big-value-tooltip"
        classList={{'malloy-big-value-tooltip--flipped': flipped()}}
      >
        {props.text}
        <div class="malloy-big-value-tooltip-arrow" />
      </div>
    </span>
  );
}

/**
 * Component to render sparkline using applyRenderer (leverages existing chart plugins)
 * Note: For dashboard sparklines, add y.independent=true in the Malloy tag to ensure
 * each row's sparkline scales to its own data range.
 */
function SparklineChart(props: {info: SparklineNestInfo}) {
  const rendering = applyRenderer({
    dataColumn: props.info.nestCell,
  });

  return <div class="malloy-big-value-sparkline">{rendering.renderValue}</div>;
}

/**
 * Single big value card component
 */
function BigValueCard(props: {
  info: DisplayFieldInfo;
  size: BigValueSize;
  neutralThreshold: number;
}) {
  const delta = createMemo(() => {
    if (
      !props.info.comparison ||
      props.info.comparisonValue === null ||
      typeof props.info.value !== 'number'
    ) {
      return null;
    }
    return calculateDelta(
      props.info.value,
      props.info.comparisonValue,
      props.info.comparison.comparisonFormat,
      props.info.comparison.downIsGood,
      props.neutralThreshold
    );
  });

  const deltaClass = createMemo(() => {
    const d = delta();
    if (!d || d.isNeutral) return 'malloy-big-value-delta--neutral';
    return d.isPositive
      ? 'malloy-big-value-delta--positive'
      : 'malloy-big-value-delta--negative';
  });

  return (
    <div
      class="malloy-big-value-card"
      classList={{
        'malloy-big-value-card--sm': props.size === 'sm',
        'malloy-big-value-card--lg': props.size === 'lg',
      }}
    >
      <div class="malloy-big-value-label-container">
        <span class="malloy-big-value-label">{props.info.label}</span>
        <Show when={props.info.docText}>
          <TooltipIcon text={props.info.docText!} />
        </Show>
      </div>
      <div class="malloy-big-value-value-row">
        <div class="malloy-big-value-value">{props.info.formattedValue}</div>
        <Show when={props.info.sparklineNest}>
          <SparklineChart info={props.info.sparklineNest!} />
        </Show>
      </div>
      <Show when={delta()}>
        <div class="malloy-big-value-comparison">
          <span class={`malloy-big-value-delta ${deltaClass()}`}>
            {delta()!.display}
          </span>
          <Show when={props.info.comparison?.comparisonLabel}>
            <span class="malloy-big-value-comparison-label">
              {props.info.comparison!.comparisonLabel}
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/**
 * Error display component
 */
function BigValueError(props: {message: string}) {
  return (
    <div class="malloy-big-value-error">
      <span class="malloy-big-value-error-icon">⚠️</span>
      {props.message}
    </div>
  );
}

/**
 * Main Big Value component
 */
export function BigValueComponent(props: BigValueComponentProps) {
  // Get the first row of data
  const firstRow = createMemo((): RecordCell | null => {
    const dataColumn = props.dataColumn;
    if ('rows' in dataColumn && dataColumn.rows.length > 0) {
      return dataColumn.rows[0];
    }
    return null;
  });

  // Get fields from the field definition
  const fields = createMemo((): Field[] => {
    const f = props.field;
    if ('fields' in f) {
      return (f as {fields: Field[]}).fields;
    }
    return [];
  });

  // Check for dimensions (validation)
  const hasDimension = createMemo(() => {
    return fields().some(f => !f.isNest() && f.wasDimension());
  });

  // Build comparison map: primaryFieldName -> { comparisonValue, ... }
  const comparisonMap = createMemo(() => {
    const map = new Map<
      string,
      {value: number; info: BigValueComparisonInfo}
    >();
    const row = firstRow();
    if (!row) return map;

    for (const fieldDef of fields()) {
      const config = props.tagConfig.fieldConfigs.get(fieldDef.name);
      if (config?.comparison) {
        const cell = row.column(fieldDef.name);
        const value = cell?.value;
        if (typeof value === 'number') {
          map.set(config.comparison.comparisonField, {
            value,
            info: config.comparison,
          });
        }
      }
    }
    return map;
  });

  // Set of field names that are comparison-only (should not render as cards)
  // Note: These fields are automatically excluded from rendering in big-value.
  // If big-value is inside a dashboard, use # hidden on comparison fields to
  // prevent them from rendering as separate dashboard items.
  const comparisonFieldNames = createMemo(() => {
    const set = new Set<string>();
    for (const fieldDef of fields()) {
      const config = props.tagConfig.fieldConfigs.get(fieldDef.name);
      if (config?.comparison) {
        set.add(fieldDef.name);
      }
    }
    return set;
  });

  // Build sparkline nest map: nestName -> SparklineNestInfo
  // Uses pre-resolved sparklineNestNames (detected from tags at setup time)
  // to find the corresponding data cells at render time.
  const sparklineNestMap = createMemo(() => {
    const map = new Map<string, SparklineNestInfo>();
    const row = firstRow();
    if (!row) return map;

    for (const fieldDef of fields()) {
      if (!fieldDef.isNest()) continue;
      if (!props.tagConfig.sparklineNestNames.has(fieldDef.name)) continue;

      const nestCell = row.column(fieldDef.name);
      if (!nestCell || !('rows' in nestCell)) continue;

      map.set(fieldDef.name, {
        nestField: fieldDef as NestField,
        nestCell: nestCell as NestCell,
      });
    }
    return map;
  });

  // Build display field info for each non-comparison field
  const displayFields = createMemo((): DisplayFieldInfo[] => {
    const row = firstRow();
    if (!row) return [];

    const result: DisplayFieldInfo[] = [];
    const compFieldNames = comparisonFieldNames();
    const compMap = comparisonMap();
    const sparkNestMap = sparklineNestMap();

    for (const fieldDef of fields()) {
      // Skip hidden fields
      if (fieldDef.isHidden()) continue;

      // Skip comparison-only fields
      if (compFieldNames.has(fieldDef.name)) continue;

      // Skip nested fields (sparklines are rendered with their parent metric)
      if (fieldDef.isNest()) continue;

      const config = props.tagConfig.fieldConfigs.get(fieldDef.name);
      const cell = row.column(fieldDef.name);
      const value = cell?.value;
      const comparison = compMap.get(fieldDef.name);

      // Look up sparkline by nest name from pre-resolved sparkline ref
      const sparklineNest = config?.sparklineRef
        ? sparkNestMap.get(config.sparklineRef) ?? null
        : null;

      result.push({
        field: fieldDef,
        cell: cell ?? null,
        label: config?.label ?? fieldDef.name,
        value,
        formattedValue: formatValue(cell ?? null),
        comparison: comparison?.info ?? null,
        comparisonValue: comparison?.value ?? null,
        docText: config?.description ?? null,
        sparklineNest,
      });
    }

    return result;
  });

  return (
    <div class="malloy-big-value">
      <Show when={!firstRow()}>
        <BigValueError message="No data to display" />
      </Show>
      <Show when={fields().length === 0}>
        <BigValueError message="No fields to display" />
      </Show>
      <Show when={hasDimension()}>
        <BigValueError message="big_value does not support group_by dimensions. Use only aggregate fields." />
      </Show>
      <Show when={firstRow() && fields().length > 0 && !hasDimension()}>
        <For each={displayFields()}>
          {info => (
            <BigValueCard
              info={info}
              size={props.settings.size}
              neutralThreshold={props.settings.neutralThreshold}
            />
          )}
        </For>
      </Show>
    </div>
  );
}
