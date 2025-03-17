import type {RendererProps} from './types';

export function renderImage(props: RendererProps) {
  const imgTag = props.tag.tag('image');
  if (!imgTag) throw new Error('Missing tag for Image renderer');
  if (!props.dataColumn.field.isAtomic())
    throw new Error('Image renderer: Field must be AtomicField');
  if (!props.dataColumn.isString() && !props.dataColumn.isNull())
    throw new Error('Image renderer: DataColumn must be StringCell');

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
    const ref = altTag.text('field');
    if (ref) {
      alt = String(props.dataColumn.getRelativeCell(ref)?.value);
    } else {
      alt = altTag.text();
    }
  }

  // src
  let src: string | undefined;
  if (!props.dataColumn.isNull()) {
    src = String(props.dataColumn.value);
  }

  return <img style={style} src={src} alt={alt} />;
}
