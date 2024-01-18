import {create} from '@storybook/theming/create';

export default create({
  base: 'light',
  brandTitle:
    '<div style="display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 500;"><img src="https://docs.malloydata.dev/img/logo.png" style="height: 24px"/><div>Renderer</div></div>',
  brandUrl: 'https://malloydata.github.io',
  fontBase: '"Inter", "Open Sans", sans-serif',
  fontCode: 'monospace',
  colorSecondary: '#477DEC',
  appBg: '#ECF1FB',
});
