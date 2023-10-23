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

export const Image = {
  args: {
    source: 'products',
    view: 'img_test',
  },
};

export const ImageFromRecord = {
  args: {
    source: 'logos',
    view: 'img_from_record',
  },
};

export const ImageFromParent = {
  args: {
    source: 'logos',
    view: 'img_from_parent',
  },
};

export const ImageFromGrandparent = {
  args: {
    source: 'logos',
    view: 'img_from_grandparent',
  },
};
