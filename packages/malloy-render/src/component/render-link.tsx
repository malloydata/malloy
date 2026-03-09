import type {Cell, Field} from '../data_tree';
import type {LinkTagConfig} from './tag-configs';

export function renderLink(f: Field, data: Cell) {
  const config = f.getTagConfig<LinkTagConfig>();
  if (!config) throw new Error('Missing tag config for Link renderer');
  if (data.isNull()) return '∅';
  const value = String(data.value);

  // Read href component from field value or override with field ref if it exists
  let hrefCell: Cell | undefined;
  if (config.linkField) {
    hrefCell = data.getRelativeCell(config.linkField);
  }
  hrefCell ??= data;
  const hrefComponent = String(hrefCell.value);

  // if a URL template is provided, replace the data where '$$' appears.
  let href: string = hrefComponent;
  if (config.urlTemplate) {
    if (config.urlTemplate.indexOf('$$') > -1) {
      href = config.urlTemplate.replace('$$', hrefComponent);
    } else {
      href = config.urlTemplate + hrefComponent;
    }
  }

  const cleanedValue = value.replace(/\//g, '/\u200C');
  return (
    <a target="_blank" href={href}>
      {cleanedValue}
    </a>
  );
}
