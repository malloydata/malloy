import {For, Show, createMemo} from 'solid-js';
import type {Field, RecordCell, NestCell} from '@/data_tree';
import {renderNumericField} from '@/component/render-numeric-field';
import {NULL_SYMBOL} from '@/util';
import type {
  BigValueSettings,
  BigValueComparisonInfo,
  ComparisonFormat,
  BigValueSize,
} from './big-value-settings';

/**
 * Props for the BigValueComponent
 */
export interface BigValueComponentProps {
  /** The data cell containing the row(s) */
  dataColumn: NestCell;
  /** Field metadata */
  field: Field;
  /** Plugin settings */
  settings: BigValueSettings;
}

/**
 * Information about a field to display as a big value card
 */
interface DisplayFieldInfo {
  field: Field;
  label: string;
  value: unknown;
  formattedValue: string;
  comparison: BigValueComparisonInfo | null;
  comparisonValue: number | null;
  docText: string | null;
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
 * Convert snake_case to Title Case
 */
function snakeToTitleCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get the display label for a field
 * Priority: # label annotation > snake_case conversion of field name
 */
function getFieldLabel(field: Field): string {
  const labelTag = field.tag.text('label');
  if (labelTag) return labelTag;
  return snakeToTitleCase(field.name);
}

/**
 * Extract doc annotation from field metadata
 * Looks for #(doc) annotations
 */
function getDocAnnotation(field: Field): string | null {
  // Check field.field.annotations array (raw Malloy format)
  const fieldInfo = field.field;
  if (fieldInfo?.annotations && Array.isArray(fieldInfo.annotations)) {
    for (const ann of fieldInfo.annotations) {
      if (
        ann &&
        typeof ann.value === 'string' &&
        ann.value.includes('#(doc)')
      ) {
        return ann.value
          .replace(/^#\(doc\)\s*/, '')
          .replace(/\n$/, '')
          .trim();
      }
    }
  }
  return null;
}

/**
 * Extract comparison info from field tags
 */
function getComparisonInfo(field: Field): BigValueComparisonInfo | null {
  const tag = field.tag;
  const comparisonField = tag.text('big_value', 'comparison_field');

  if (!comparisonField) return null;

  const comparisonLabel = tag.text('big_value', 'comparison_label') ?? undefined;
  const comparisonFormat = (tag.text('big_value', 'comparison_format') ??
    'pct') as ComparisonFormat;
  const downIsGood = tag.text('big_value', 'down_is_good') === 'true';

  return {
    comparisonField,
    comparisonLabel,
    comparisonFormat,
    downIsGood,
  };
}

/**
 * Calculate the delta between primary and comparison values
 */
function calculateDelta(
  primaryValue: number,
  comparisonValue: number,
  format: ComparisonFormat,
  downIsGood: boolean
): DeltaResult {
  // Handle invalid inputs
  if (
    primaryValue == null ||
    comparisonValue == null ||
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

    // Consider very small changes as neutral (< 0.05 ppt)
    if (Math.abs(pptChange) < 0.05) {
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

  // Consider very small changes as neutral (< 0.05%)
  if (Math.abs(percentChange) < 0.05) {
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
 */
function formatValue(field: Field, value: unknown): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }

  if (typeof value === 'number') {
    return renderNumericField(field, value);
  }

  return String(value);
}

/**
 * Tooltip icon component with hover functionality
 */
function TooltipIcon(props: {text: string}) {
  return (
    <span class="malloy-big-value-tooltip-icon">
      i
      <div class="malloy-big-value-tooltip">
        {props.text}
        <div class="malloy-big-value-tooltip-arrow" />
      </div>
    </span>
  );
}

/**
 * Single big value card component
 */
function BigValueCard(props: {
  info: DisplayFieldInfo;
  size: BigValueSize;
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
      props.info.comparison.downIsGood
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
      <div class="malloy-big-value-value">{props.info.formattedValue}</div>
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
    return fields().some(f => f.wasDimension());
  });

  // Build comparison map: primaryFieldName -> { comparisonValue, ... }
  const comparisonMap = createMemo(() => {
    const map = new Map<string, {value: number; info: BigValueComparisonInfo}>();
    const row = firstRow();
    if (!row) return map;

    for (const fieldDef of fields()) {
      const comparisonInfo = getComparisonInfo(fieldDef);
      if (comparisonInfo) {
        const cell = row.column(fieldDef.name);
        const value = cell?.value;
        if (typeof value === 'number') {
          map.set(comparisonInfo.comparisonField, {
            value,
            info: comparisonInfo,
          });
        }
      }
    }
    return map;
  });

  // Set of field names that are comparison-only (should not render as cards)
  const comparisonFieldNames = createMemo(() => {
    const set = new Set<string>();
    for (const fieldDef of fields()) {
      const comparisonInfo = getComparisonInfo(fieldDef);
      if (comparisonInfo) {
        set.add(fieldDef.name);
      }
    }
    return set;
  });

  // Build display field info for each non-comparison field
  const displayFields = createMemo((): DisplayFieldInfo[] => {
    const row = firstRow();
    if (!row) return [];

    const result: DisplayFieldInfo[] = [];
    const compFieldNames = comparisonFieldNames();
    const compMap = comparisonMap();

    for (const fieldDef of fields()) {
      // Skip hidden fields
      if (fieldDef.isHidden()) continue;

      // Skip comparison-only fields
      if (compFieldNames.has(fieldDef.name)) continue;

      const cell = row.column(fieldDef.name);
      const value = cell?.value;
      const comparison = compMap.get(fieldDef.name);

      result.push({
        field: fieldDef,
        label: getFieldLabel(fieldDef),
        value,
        formattedValue: formatValue(fieldDef, value),
        comparison: comparison?.info ?? null,
        comparisonValue: comparison?.value ?? null,
        docText: getDocAnnotation(fieldDef),
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
          {info => <BigValueCard info={info} size={props.settings.size} />}
        </For>
      </Show>
    </div>
  );
}
