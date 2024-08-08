import script from './static/link.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render-webcomponent';

export default {
  title: 'Malloy Next/Link',
  render: ({classes}, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';
    const el = document.createElement('malloy-render');
    if (classes) el.classList.add(classes);
    el.result = context.loaded['result'];
    parent.appendChild(el);
    return parent;
  },
  loaders: [createLoader(script)],
  argTypes: {},
};

export const Link = {
  args: {
    source: 'logos',
    view: 'link',
  },
};

export const LinkFromTemplate = {
  args: {
    source: 'logos',
    view: 'link_template',
  },
};

export const LinkFromKeyColumn = {
  args: {
    source: 'logos',
    view: 'link_template_key_column',
  },
};
