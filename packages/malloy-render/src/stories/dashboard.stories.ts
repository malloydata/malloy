import {Meta} from '@storybook/html';
import script from './static/dashboard.malloy?raw';
import {createLoader} from './util';
import './themes.css';
import '../component/render-webcomponent';

const meta: Meta = {
  title: 'Malloy Next/Dashboard',
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

export default meta;

export const Dashboard = {
  args: {
    source: 'products',
    view: 'dash',
  },
};

export const DashboardDense = {
  args: {
    source: 'products',
    view: 'dash_dense',
  },
};
