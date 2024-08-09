import {
  AtomicField,
  DataArray,
  DataColumn,
  Explore,
  ExploreField,
  Field,
  Tag,
} from '@malloydata/malloy';
import {RenderResultMetadata} from './types';
import {shouldRenderAs, valueIsNumber, valueIsString} from './util';
import {JSXElement} from 'solid-js';
import {renderNumericField} from './render-numeric-field';
import {renderLink} from './render-link';
import {Chart} from './chart';
import MalloyTable from './table/table';
import {renderList} from './render-list';
import {renderImage} from './render-image';

export type RendererProps = {
  field: Field;
  dataColumn: DataColumn;
  resultMetadata: RenderResultMetadata;
  tag: Tag;
  customProps?: Record<string, Record<string, unknown>>;
};

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
        renderValue = '∅';
      } else if (valueIsString(field, resultCellValue)) {
        renderValue = resultCellValue;
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
    case 'table': {
      renderValue = (
        <MalloyTable data={dataColumn as DataArray} {...propsToPass} />
      );
      break;
    }
    default: {
      try {
        renderValue = String(dataColumn.value);
      } catch (err) {
        console.warn('Couldnt get value for ', field, dataColumn);
      }
    }
  }
  return {renderAs, renderValue};
}
