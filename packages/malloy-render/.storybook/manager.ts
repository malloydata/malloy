import React from 'react';
import {addons, types} from '@storybook/manager-api';
import theme from './theme';
import {RendererLogsPanel, ADDON_ID, PANEL_ID} from './renderer-logs-panel';

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Renderer Logs',
    render: ({active}) => React.createElement(RendererLogsPanel, {active}),
  });
});

addons.setConfig({
  theme,
  isFullscreen: false,
  showNav: true,
  showPanel: true,
  panelPosition: 'bottom',
  enableShortcuts: true,
  showToolbar: false,
  selectedPanel: PANEL_ID,
  initialActive: 'sidebar',
  sidebar: {},
  toolbar: {},
});
