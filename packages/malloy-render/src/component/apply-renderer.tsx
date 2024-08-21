import {
  AtomicField,
  DataArrayOrRecord,
  DataColumn,
  Explore,
  ExploreField,
  Field,
  Tag,
} from '@malloydata/malloy';
import {RenderResultMetadata} from './types';
import {valueIsNumber, valueIsString} from './util';
import {JSXElement} from 'solid-js';
import {renderNumericField} from './render-numeric-field';
import {renderLink} from './render-link';
import {Chart} from './chart';
import MalloyTable from './table/table';
import {renderList} from './render-list';
import {renderImage} from './render-image';
import {Dashboard} from './dashboard/dashboard';
import {LegacyChart} from './legacy-charts/legacy_chart';
import {hasAny} from './tag-utils';
import {renderTime} from './render-time';

export type RendererProps = {
  field: Field;
  dataColumn: DataColumn;
  resultMetadata: RenderResultMetadata;
  tag: Tag;
  customProps?: Record<string, Record<string, unknown>>;
};

export function shouldRenderAs(f: Field | Explore, tagOverride?: Tag) {
  const tag = tagOverride ?? f.tagParse().tag;
  if (!f.isExplore() && f.isAtomicField()) {
    if (tag.has('link')) return 'link';
    if (tag.has('image')) return 'image';
    return 'cell';
  }
  if (hasAny(tag, 'list', 'list_detail')) return 'list';
  if (hasAny(tag, 'bar_chart')) return 'chart';
  if (tag.has('dashboard')) return 'dashboard';
  if (tag.has('line_chart')) return 'line_chart';
  if (tag.has('scatter_chart')) return 'scatter_chart';
  if (tag.has('shape_map')) return 'shape_map';
  if (tag.has('segment_map')) return 'segment_map';
  else return 'table';
}

const NULL_SYMBOL = '∅';

export function applyRenderer(props: RendererProps) {
  const {field, dataColumn, resultMetadata, tag, customProps = {}} = props;
  const renderAs = shouldRenderAs(field, tag);
  let renderValue: JSXElement = '';
  const propsToPass = customProps[renderAs] || {};
  switch (renderAs) {
    case 'cell': {
      const resultCellValue = dataColumn.value;
      if (valueIsNumber(field, resultCellValue)) {
        // TS doesn't support typeguards for multiple parameters, so unfortunately have to assert AtomicField here. https://github.com/microsoft/TypeScript/issues/26916
        renderValue = renderNumericField(field as AtomicField, resultCellValue);
      } else if (resultCellValue === null) {
        renderValue = NULL_SYMBOL;
      } else if (valueIsString(field, resultCellValue)) {
        renderValue = resultCellValue;
      } else if (
        field.isAtomicField() &&
        (field.isDate() || field.isTimestamp())
      ) {
        renderValue = renderTime(props);
      } else {
        // try to force to string
        renderValue = String(resultCellValue);
      }
      break;
    }
    case 'link': {
      // renderAs will only return link for AtomicFields. TODO: add additional typeguard here?
      renderValue = renderLink(field as AtomicField, dataColumn);
      break;
    }
    case 'list': {
      // TODO: typeguard here?
      renderValue = renderList(props);
      break;
    }
    case 'image': {
      renderValue = renderImage(props);
      break;
    }
    case 'chart': {
      renderValue = (
        <Chart
          field={field as ExploreField}
          data={resultMetadata.getData(dataColumn)}
          metadata={resultMetadata}
          {...propsToPass}
        />
      );
      break;
    }
    case 'dashboard': {
      if (dataColumn.isArray()) renderValue = <Dashboard data={dataColumn} />;
      else if (dataColumn.isNull()) renderValue = NULL_SYMBOL;
      else
        throw new Error(
          `Malloy render: wrong data type passed to the dashboard renderer for field ${dataColumn.field.name}`
        );
      break;
    }
    case 'line_chart':
    case 'scatter_chart':
    case 'shape_map':
    case 'segment_map': {
      if (dataColumn.isArray())
        renderValue = <LegacyChart type={renderAs} data={dataColumn} />;
      else if (dataColumn.isNull()) renderValue = NULL_SYMBOL;
      else
        throw new Error(
          `Malloy render: wrong data type passed to the ${renderAs} renderer for field ${dataColumn.field.name}`
        );
      break;
    }
    case 'table': {
      if (dataColumn.isArrayOrRecord())
        renderValue = (
          <MalloyTable
            data={dataColumn as DataArrayOrRecord}
            {...propsToPass}
          />
        );
      else if (dataColumn.isNull()) renderValue = NULL_SYMBOL;
      else
        throw new Error(
          `Malloy render: wrong data type passed to the table renderer for field ${dataColumn.field.name}`
        );
      break;
    }
    default: {
      try {
        renderValue = String(dataColumn.value);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Couldnt get value for ', field, dataColumn);
      }
    }
  }
  return {renderAs, renderValue};
}
