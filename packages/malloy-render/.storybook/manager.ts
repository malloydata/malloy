import {addons} from '@storybook/manager-api';
import theme from './theme';

addons.setConfig({
  theme,
  isFullscreen: false,
  showNav: true,
  showPanel: false,
  panelPosition: 'bottom',
  enableShortcuts: true,
  showToolbar: false,
  selectedPanel: undefined,
  initialActive: 'sidebar',
  sidebar: {},
  toolbar: {},
});
