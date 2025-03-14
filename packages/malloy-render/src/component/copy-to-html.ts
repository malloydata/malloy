import type {MalloyRenderProps} from './render';

export async function copyMalloyRenderHTML(
  element: HTMLElement & MalloyRenderProps
) {
  const html = await getMalloyRenderHTML(element);
  try {
    await navigator.clipboard.writeText(html);
  } catch (error) {
    /* eslint-disable no-console */
    console.error('Failed to copy text: ', error);
  }
}

export async function getMalloyRenderHTML(
  element: HTMLElement & MalloyRenderProps
) {
  let html = '';

  const originalTableConfig = element.tableConfig ?? {};
  const copyHTMLTableConfig = Object.assign(
    {
      disableVirtualization: true,
    },
    originalTableConfig
  );
  element.tableConfig = copyHTMLTableConfig;

  const originalDashboardConfig = element.dashboardConfig ?? {};
  const copyHTMLDashboardConfig = Object.assign(
    {
      disableVirtualization: true,
    },
    originalDashboardConfig
  );
  element.dashboardConfig = copyHTMLDashboardConfig;

  // Give charts time to re-render after configuration changes
  await sleep(1000);

  if (element.shadowRoot) {
    let styles = '';
    for (const stylesheet of [...element.shadowRoot.adoptedStyleSheets]) {
      for (let i = 0; i < stylesheet.cssRules.length; i++) {
        const cssRule = stylesheet.cssRules.item(i);
        if (cssRule) styles += '\n' + cssRule.cssText;
      }

      styles = styles.replaceAll(':host', '.malloy_html_host');
      const shadowStyle = element.getAttribute('style');
      html = `
  <div>
    <style>
      ${styles}

      form.vega-bindings {
        margin-block: 0em;
      }
    </style>
    <div class="malloy_html_host" style="${shadowStyle}">
      ${element.shadowRoot.innerHTML}
    </div>
  </div>
    `;
    }
  } else html = element.innerHTML;

  // Reset element configuration
  element.tableConfig = originalTableConfig;
  element.dashboardConfig = originalDashboardConfig;

  return html;
}

function sleep(n: number) {
  return new Promise(resolve => {
    setTimeout(resolve, n);
  });
}
