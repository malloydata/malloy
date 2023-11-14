import {HTMLView} from '../html';
import {RendererOptions} from '../renderer_types';
import {QueryOptions, runQuery} from './util';

type RenderOptions = QueryOptions & {
  classes?: '';
};

async function runAndRender(
  {script, source, view, connection}: RenderOptions,
  options: RendererOptions = {dataStyles: {}}
) {
  const viewer = new HTMLView(document);
  const result = await runQuery({script, source, view, connection});
  return await viewer.render(result, options);
}

export function renderMalloy(options: RenderOptions) {
  const div = document.createElement('div');
  runAndRender(options, {
    dataStyles: {},
  }).then(el => {
    if (options.classes) el.classList.add(options.classes);
    div.replaceChildren(el);
  });
  return div;
}
