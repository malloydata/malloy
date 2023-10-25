import script from './static/basic.malloy?raw';
import {renderMalloy} from './render-malloy';

export default {
  title: 'Malloy/Basic',
  render: ({source, view}, {globals: {connection}}) => {
    return renderMalloy({script, source, view, connection});
  },
  argTypes: {},
};

export const ProductsTable = {
  args: {
    source: 'products',
    view: '{ select: * }',
  },
};

export const ProductsBar = {
  args: {
    source: 'products',
    view: 'category_bar',
  },
};
