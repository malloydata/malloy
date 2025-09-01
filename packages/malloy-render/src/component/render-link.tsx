import type {Cell, Field} from '../data_tree';

export function renderLink(f: Field, data: Cell) {
  const tag = f.tag;
  if (data.isNull()) return '∅';
  const value = String(data.value);
  const linkTag = tag.tag('link');
  if (!linkTag) throw new Error('Missing tag for Link renderer');
  // Read href component from field value or override with field tag if it exists
  const dynamicRef = linkTag.text('field');
  let hrefCell: Cell | undefined;
  if (dynamicRef) {
    hrefCell = data.getRelativeCell(dynamicRef);
  }
  hrefCell ??= data;
  const hrefComponent = String(hrefCell.value);

  // if a URL template is provided, replace the data were '$$$' appears.
  const urlTemplate = linkTag.text('url_template');

  let href: string = hrefComponent;
  if (urlTemplate) {
    if (urlTemplate.indexOf('$$') > -1) {
      href = urlTemplate.replace('$$', hrefComponent);
    } else {
      href = urlTemplate + hrefComponent;
    }
  }

  const cleanedValue = value.replace(/\//g, '/\u200C');
  return (
    <a target="_blank" href={href}>
      {cleanedValue}
    </a>
  );
}
