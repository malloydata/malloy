import script from './static/image.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render-webcomponent';

export default {
  title: 'Malloy Next/Image',
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

export const ImageAltFromRecord = {
  args: {
    source: 'logos',
    view: 'img_from_record',
  },
};

export const ImageAltFromParent = {
  args: {
    source: 'logos',
    view: 'img_from_parent',
  },
};

export const ImageAltFromGrandparent = {
  args: {
    source: 'logos',
    view: 'img_from_grandparent',
  },
};
