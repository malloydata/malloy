import script from './static/list.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render-webcomponent';

export default {
  title: 'Malloy Next/List',
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

export const List = {
  args: {
    source: 'logos',
    view: 'list',
  },
};

export const ListNumbers = {
  args: {
    source: 'logos',
    view: 'list_number',
  },
};

export const ListDetail = {
  args: {
    source: 'logos',
    view: 'list_detail',
  },
};

export const ListDetailRenderers = {
  args: {
    source: 'logos',
    view: 'list_detail_renderers',
  },
};

export const NestedList = {
  args: {
    source: 'logos',
    view: 'nested_list',
  },
};
