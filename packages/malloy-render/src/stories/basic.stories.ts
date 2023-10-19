import script from './static/basic.malloy?raw';
import {renderMalloy} from './render-malloy';

export default {
  title: 'Malloy/Basic',
  render: ({source, view}) => {
    return renderMalloy({script, source, view});
  },
  argTypes: {},
};

export const ProductsTable = {
  args: {
    source: 'products',
    view: '{ select: * }',
  },
};
