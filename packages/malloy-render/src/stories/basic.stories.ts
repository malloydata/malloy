import script from './static/basic.malloy?raw';
import {renderMalloy} from './render-malloy-legacy';

export default {
  title: 'Malloy Legacy/Basic',
  render: ({source, view}, {globals: {connection}}) => {
    return renderMalloy({script, source, view, connection});
  },
  argTypes: {},
};

export const ProductsTable = {
  args: {
    source: 'products',
    view: 'records',
  },
};

export const ProductsBar = {
  args: {
    source: 'products',
    view: 'category_bar',
  },
};

export const FlattenNestedMeasures = {
  args: {
    source: 'products',
    view: 'flatten',
  },
};
