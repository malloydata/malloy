import type {RendererProps} from './types';
import type {ImageTagConfig} from './tag-configs';

export function renderImage(props: RendererProps) {
  const config = props.dataColumn.field.getTagConfig<ImageTagConfig>();
  if (!config) throw new Error('Missing tag config for Image renderer');
  if (!props.dataColumn.field.isBasic())
    throw new Error('Image renderer: Field must be AtomicField');
  if (!props.dataColumn.isString() && !props.dataColumn.isNull())
    throw new Error('Image renderer: DataColumn must be StringCell');

  // Sizing
  const style = {};
  if (config.width) style['width'] = config.width;
  if (config.height) style['height'] = config.height;

  // Alt text
  let alt: string | undefined;
  if (config.altField) {
    alt = String(props.dataColumn.getRelativeCell(config.altField)?.value);
  } else if (config.alt) {
    alt = config.alt;
  }

  // src
  let src: string | undefined;
  if (!props.dataColumn.isNull()) {
    src = String(props.dataColumn.value);
  }

  return <img style={style} src={src} alt={alt} />;
}
