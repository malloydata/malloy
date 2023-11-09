import script from './static/tables.malloy?raw';
import {renderMalloy} from './render-malloy';
import './themes.css';

export default {
  title: 'Malloy Next/Tables',
  render: ({source, view, classes}, {globals: {connection}}) => {
    return renderMalloy({script, source, view, connection, classes});
  },
  argTypes: {},
};

export const ProductsTable = {
  args: {
    source: 'products',
    view: `records`,
  },
};

export const ProductsTableCustomTheme = {
  args: {
    source: 'products',
    view: 'records',
    classes: 'night',
  },
};

export const Products2Column = {
  args: {
    source: 'products',
    view: 'category_bar',
  },
};
