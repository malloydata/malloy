/*
 * Example: Using Nivo Plugins with Malloy Renderer
 *
 * This demonstrates how to register and use Nivo plugins
 * with the Malloy renderer.
 */

import { MalloyRenderer } from '@malloydata/render';
import {
  NivoBarChartPluginFactory,
  NivoPieChartPluginFactory,
} from '@malloy-examples/nivo-plugin';

// Create a Malloy renderer with Nivo plugins registered
const renderer = new MalloyRenderer({
  plugins: [NivoBarChartPluginFactory, NivoPieChartPluginFactory],
  pluginOptions: {
    // Configure bar chart plugin
    nivo_bar_chart: {
      colorScheme: 'category10',
      showLegends: true,
      enableAnimations: true,
      padding: 0.3,
      layout: 'vertical',
    },
    // Configure pie chart plugin
    nivo_pie_chart: {
      colorScheme: 'nivo',
      enableSliceLabels: true,
      enableArcLinkLabels: true,
      innerRadius: 0, // Set to > 0 for donut chart
      padAngle: 0.7,
      cornerRadius: 3,
    },
  },
});

// Example: Render Malloy query results with Nivo visualization
async function renderMalloyResults() {
  // Assuming you have a Malloy result object
  const result = await runMalloyQuery(); // Your Malloy query execution

  // Render the result with Nivo plugins
  const html = await renderer.renderToHTML(result);

  // Insert into DOM
  document.getElementById('visualization-container')!.innerHTML = html;
}

// Mock function - replace with actual Malloy query execution
async function runMalloyQuery() {
  // This would typically come from executing a Malloy query
  // that includes fields tagged with #nivo_bar_chart or #nivo_pie_chart
  throw new Error('Implement your Malloy query execution here');
}
