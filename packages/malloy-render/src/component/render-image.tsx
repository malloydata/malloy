import {RendererProps} from './apply-renderer';
import {
  getCellValue,
  getDynamicValue,
  isAtomic,
  valueIsNull,
  valueIsString,
} from './util';

export function renderImage(props: RendererProps) {
  const imgTag = props.tag.tag('image');
  if (!imgTag) throw new Error('Missing tag for Image renderer');
  if (!isAtomic(props.field))
    throw new Error('Image renderer: Field must be AtomicField');
  if (!valueIsString(props.field, props.dataColumn))
    throw new Error('Image renderer: DataColumn must be DataString');

  // Sizing
  const width = imgTag.text('width');
  const height = imgTag.text('height');
  const style = {};
  if (width) style['width'] = width;
  if (height) style['height'] = height;

  // Alt text
  let alt: string | undefined;
  const altTag = imgTag.tag('alt');
  if (altTag) {
    alt =
      getDynamicValue<string>({tag: altTag, data: props.dataColumn}) ??
      altTag.text();
  }

  // src
  let src: string | undefined;
  if (!valueIsNull(props.dataColumn)) {
    src = String(getCellValue(props.dataColumn));
  }

  return <img style={style} src={src} alt={alt} />;
}
