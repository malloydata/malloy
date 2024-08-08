import script from './static/link.malloy?raw';
import {renderMalloy} from './render-malloy-legacy';

export default {
  title: 'Malloy Legacy/Link',
  render: ({source, view}, {globals: {connection}}) => {
    return renderMalloy({script, source, view, connection});
  },
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
