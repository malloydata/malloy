import { JSX, createMemo, For, Show } from 'solid-js';
import './cohort-table.css';

import type {
  RecordOrRepeatedRecordCell,
  Field,
  Cell,
} from '../../data_tree';
import { useConfig } from '../render';

// Extending the click event types to support cohort-cell
declare module '../render' {
  interface RenderConfig {
    onClick?: (data: ClickData) => void;
  }
  
  interface ClickData {
    type: 'dashboard-item' | 'table-cell' | 'cohort-cell';
    // Other existing properties
  }
}

export function CohortTable(props: {
  data: RecordOrRepeatedRecordCell;
}): JSX.Element {
  const config = useConfig();
  
  // Get the dimension fields from the data
  const getDimensionFields = (): Field[] => {
    if (!props.data.rows.length) return [];
    
    // Get fields from the first row
    const row = props.data.rows[0];
    return row.field.fields.filter(field => !field.isNest() && field.name !== 'order_count');
  };
  
  // Get the measure field from the data
  const getMeasureField = (): Field | undefined => {
    if (!props.data.rows.length) return undefined;
    
    // Get fields from the first row
    const row = props.data.rows[0];
    // Find the first measure (non-dimension) field
    return row.field.fields.find(field => field.isNest());
  };
  
  // Get dimension fields
  const dimensionFields = createMemo(() => getDimensionFields());
  
  // We need at least two dimensions for a cohort table
  if (dimensionFields().length < 2) {
    return <div class="malloy-error" part="error-message">Cohort table requires at least two dimensions</div>;
  }
  
  // Use first dimension for vertical axis (cohorts)
  const verticalDimension = createMemo(() => dimensionFields()[0]);
  
  // Use second dimension for horizontal axis (periods)
  const horizontalDimension = createMemo(() => dimensionFields()[1]);
  
  // Get measure field (or fallback to 'order_count' if available)
  const measureField = createMemo(() => {
    const field = getMeasureField() || 
      props.data.rows[0].field.fields.find(field => field.name === 'order_count');
    return field as Field;
  });
  
  // Format date values appropriately based on granularity
  const formatDateValue = (value: any): string => {
    if (!value) return '';
    
    try {
      // Handle Date objects
      if (value instanceof Date) {
        // Default format: YYYY-MM-DD
        return value.toISOString().split('T')[0];
      }
      
      // Try to parse string dates
      if (typeof value === 'string') {
        // Handle different formats (day, week, month, etc.)
        if (value.includes('-') || value.includes('/')) {
          return value; // Keep existing format for now
        }
      }
      
      // Just return as string if we couldn't format
      return String(value);
    } catch (e) {
      console.warn("Error formatting date:", value, e);
      return String(value);
    }
  };
  
  // Format display of dates for UI
  const formatDateDisplay = (value: string): string => {
    try {
      // YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const date = new Date(value);
        // Format as "Mon D, YYYY" - e.g., "Dec 1, 2010"
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
      
      // YYYY-MM format (month)
      if (/^\d{4}-\d{2}$/.test(value)) {
        const [year, month] = value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = parseInt(month, 10) - 1;
        if (monthNames[monthIndex]) {
          // "Jan 22" format for simplicity
          const twoDigitYear = year.substring(2);
          return `${monthNames[monthIndex]} ${twoDigitYear}`;
        }
      }
      
      return value; // Return unchanged if not in expected format
    } catch (e) {
      return value;
    }
  };
  
  // Safely try to get a column value
  const safeGetColumnValue = (row: any, fieldName: string) => {
    try {
      const col = row.column(fieldName);
      return col?.value !== undefined ? col.value : null;
    } catch (e) {
      console.warn(`Error getting column ${fieldName}:`, e);
      return null;
    }
  };

  // Get and format vertical dimension values (e.g., cohorts)
  const verticalValuesRaw = createMemo(() => props.data.rows.map(row => 
    safeGetColumnValue(row, verticalDimension().name)
  ));
  
  const verticalValues = createMemo(() => [...new Set(
    verticalValuesRaw().map(value => {
      if (value instanceof Date || (typeof value === 'string' && (value.includes('-') || value.includes('/')))) {
        return formatDateValue(value);
      }
      return value;
    })
  )].filter(Boolean).sort());
  
  // Get and format horizontal dimension values (e.g., time periods)
  const horizontalValuesRaw = createMemo(() => props.data.rows.map(row => 
    safeGetColumnValue(row, horizontalDimension().name)
  ));
  
  const horizontalValues = createMemo(() => [...new Set(
    horizontalValuesRaw().map(value => {
      if (value instanceof Date || (typeof value === 'string' && (value.includes('-') || value.includes('/')))) {
        return formatDateValue(value);
      }
      return value;
    })
  )].filter(Boolean).sort());
  
  // Create lookup map for cell values with formatted keys
  const valueMap = createMemo(() => {
    const map = new Map<string, any>();
    const allValues: number[] = [];
    
    props.data.rows.forEach(row => {
      const verticalRaw = safeGetColumnValue(row, verticalDimension().name);
      const horizontalRaw = safeGetColumnValue(row, horizontalDimension().name);
      
      // Use measure field if available, otherwise fallback to 'order_count'
      const measure = measureField() ? safeGetColumnValue(row, measureField().name) : null;
      
      // Format date values for keys
      const verticalValue = verticalRaw instanceof Date ? formatDateValue(verticalRaw) : verticalRaw;
      const horizontalValue = horizontalRaw instanceof Date ? formatDateValue(horizontalRaw) : horizontalRaw;
      
      if (verticalValue && horizontalValue && measure !== null && measure !== undefined) {
        const numValue = Number(measure);
        if (!isNaN(numValue)) {
          allValues.push(numValue);
        }
        map.set(`${verticalValue}-${horizontalValue}`, measure);
      }
    });
    
    return { map, allValues };
  });
  
  // Find max value for color scaling
  const maxValue = createMemo(() => valueMap().allValues.length ? Math.max(...valueMap().allValues) : 0);
  
  // Color scale function - very light blue intensity heatmap
  const getHeatmapColor = (value: number | null): string => {
    if (value === null || value === undefined || maxValue() === 0) return 'transparent';
    
    const normalizedValue = Math.min(1, Math.max(0, value / maxValue()));
    
    // Use a very light blue heatmap matching the screenshot
    return `rgba(204, 221, 255, ${normalizedValue * 0.8})`;
  };

  // Format cell value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toString();
    return String(value);
  };

  // Get human-readable names for the dimensions
  const verticalLabel = createMemo(() => {
    const name = verticalDimension() ? verticalDimension().name.replace(/_/g, ' ') : 'cohort';
    return name;
  });
  
  const horizontalLabel = createMemo(() => {
    const name = horizontalDimension() ? horizontalDimension().name.replace(/_/g, ' ') : 'order week';
    return name;
  });
  
  // Determine if dimensions are likely dates
  const isDateLike = (values: any[]): boolean => {
    return values.some(value => 
      value instanceof Date || 
      (typeof value === 'string' && (value.includes('-') || value.includes('/')))
    );
  };
  
  const isVerticalDate = createMemo(() => isDateLike(verticalValuesRaw()));
  const isHorizontalDate = createMemo(() => isDateLike(horizontalValuesRaw()));

  return (
    <div class="malloy-cohort-table-wrapper" part="table-container">
      <table class="malloy-cohort-table" part="table">
        <thead part="table-header">
          <tr part="table-row">
            <th class="malloy-corner-header" part="table-header-cell">
              {`${verticalLabel()} / ${horizontalLabel()}`}
            </th>
            <For each={horizontalValues()}>
              {value => {
                // Use simple date display for column headers
                const displayValue = isHorizontalDate() && typeof value === 'string' ? 
                  formatDateDisplay(value) : value;
                return <th class="malloy-period-header" part="table-header-cell">{displayValue}</th>;
              }}
            </For>
          </tr>
        </thead>
        <tbody part="table-body">
          <For each={verticalValues()}>
            {vertical => (
              <tr class="malloy-table-row" part="table-row">
                <td class="malloy-cohort-label" part="table-cell">
                  {isVerticalDate() && typeof vertical === 'string' ? formatDateDisplay(vertical) : vertical}
                </td>
                <For each={horizontalValues()}>
                  {horizontal => {
                    const value = valueMap().map.get(`${vertical}-${horizontal}`);
                    const numValue = value !== undefined ? Number(value) : null;
                    const isValidNumber = numValue !== null && !isNaN(numValue);
                    
                    return (
                      <td 
                        class="malloy-cohort-cell" 
                        part="table-cell"
                        style={{ 
                          background: isValidNumber ? getHeatmapColor(numValue) : 'transparent',
                          'text-align': 'center'
                        }}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  }}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
} 