# Testing Guide for Malloy Nivo Plugins

This guide provides comprehensive instructions for testing the Nivo plugins with Malloy, from unit tests to integration tests and manual testing.

## Table of Contents

1. [Setting Up Your Test Environment](#setting-up-your-test-environment)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [Manual Testing](#manual-testing)
5. [Visual Testing](#visual-testing)
6. [Testing Checklist](#testing-checklist)
7. [Common Issues and Debugging](#common-issues-and-debugging)

## Setting Up Your Test Environment

### 1. Install Dependencies

```bash
# Navigate to the plugin directory
cd examples/nivo-plugin

# Install dependencies
npm install

# Install test dependencies
npm install --save-dev \
  jest \
  @testing-library/react \
  @testing-library/jest-dom \
  @types/jest \
  ts-jest \
  @malloydata/db-duckdb
```

### 2. Create Test Configuration

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '^@malloydata/render/(.*)$': '<rootDir>/../../packages/malloy-render/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
};
```

### 3. Create Test Setup File

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom';

// Mock ResizeObserver (used by Nivo's responsive components)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
```

## Unit Testing

### Testing Plugin Matching Logic

Create `tests/unit/plugin-matching.test.ts`:

```typescript
import { FieldType } from '@malloydata/render/data_tree';
import { Tag } from '@malloydata/malloy-tag';
import {
  NivoBarChartPluginFactory,
  NivoPieChartPluginFactory,
  NivoMarimekkoPluginFactory,
} from '../../src';

describe('Plugin Matching', () => {
  const mockField = {
    name: 'test_field',
    isNest: () => true,
    isNumber: () => false,
  } as any;

  describe('Bar Chart Plugin', () => {
    it('should match fields with nivo_bar_chart tag', () => {
      const tag = new Tag({ nivo_bar_chart: {} });
      const result = NivoBarChartPluginFactory.matches(
        mockField,
        tag,
        FieldType.RepeatedRecord
      );
      expect(result).toBe(true);
    });

    it('should not match fields without the tag', () => {
      const tag = new Tag({});
      const result = NivoBarChartPluginFactory.matches(
        mockField,
        tag,
        FieldType.RepeatedRecord
      );
      expect(result).toBe(false);
    });

    it('should throw error if field is not RepeatedRecord', () => {
      const tag = new Tag({ nivo_bar_chart: {} });
      expect(() => {
        NivoBarChartPluginFactory.matches(mockField, tag, FieldType.String);
      }).toThrow('repeated record');
    });
  });

  describe('Pie Chart Plugin', () => {
    it('should match fields with nivo_pie_chart tag', () => {
      const tag = new Tag({ nivo_pie_chart: {} });
      const result = NivoPieChartPluginFactory.matches(
        mockField,
        tag,
        FieldType.RepeatedRecord
      );
      expect(result).toBe(true);
    });

    it('should throw error if field is not RepeatedRecord', () => {
      const tag = new Tag({ nivo_pie_chart: {} });
      expect(() => {
        NivoPieChartPluginFactory.matches(mockField, tag, FieldType.Number);
      }).toThrow('repeated record');
    });
  });

  describe('Marimekko Plugin', () => {
    it('should match fields with nivo_marimekko tag', () => {
      const tag = new Tag({ nivo_marimekko: {} });
      const result = NivoMarimekkoPluginFactory.matches(
        mockField,
        tag,
        FieldType.RepeatedRecord
      );
      expect(result).toBe(true);
    });

    it('should validate field type correctly', () => {
      const tag = new Tag({ nivo_marimekko: {} });
      expect(() => {
        NivoMarimekkoPluginFactory.matches(
          mockField,
          tag,
          FieldType.Boolean
        );
      }).toThrow();
    });
  });
});
```

### Testing Plugin Configuration

Create `tests/unit/plugin-configuration.test.ts`:

```typescript
import { NivoBarChartPluginFactory } from '../../src';
import { FieldType } from '@malloydata/render/data_tree';
import { Tag } from '@malloydata/malloy-tag';

describe('Plugin Configuration', () => {
  const mockField = {
    name: 'test_field',
    isNest: () => true,
    children: [],
  } as any;

  it('should create plugin with default options', () => {
    const plugin = NivoBarChartPluginFactory.create(mockField);
    expect(plugin.name).toBe('nivo_bar_chart');
    expect(plugin.renderMode).toBe('dom');
    expect(plugin.sizingStrategy).toBe('fill');
  });

  it('should create plugin with custom options', () => {
    const options = {
      colorScheme: 'category10',
      showLegends: false,
    };
    const plugin = NivoBarChartPluginFactory.create(mockField, options);
    expect(plugin.name).toBe('nivo_bar_chart');
  });

  it('should return correct metadata', () => {
    const plugin = NivoBarChartPluginFactory.create(mockField);
    const metadata = plugin.getMetadata();
    expect(metadata.type).toBe('nivo_bar_chart');
    expect(metadata.fieldName).toBe('test_field');
  });
});
```

### Run Unit Tests

```bash
npm test -- --testPathPattern=unit
```

## Integration Testing

### Testing with Real Malloy Queries

Create `tests/integration/malloy-integration.test.ts`:

```typescript
import { Runtime } from '@malloydata/malloy';
import { DuckDBConnection } from '@malloydata/db-duckdb';
import { MalloyRenderer } from '@malloydata/render';
import {
  NivoBarChartPluginFactory,
  NivoPieChartPluginFactory,
} from '../../src';

describe('Malloy Integration Tests', () => {
  let runtime: Runtime;
  let connection: DuckDBConnection;
  let renderer: MalloyRenderer;

  beforeAll(async () => {
    // Initialize DuckDB connection
    connection = await DuckDBConnection.create({
      workingDirectory: './test-data',
    });

    runtime = new Runtime({}, connection);

    renderer = new MalloyRenderer({
      plugins: [NivoBarChartPluginFactory, NivoPieChartPluginFactory],
    });
  });

  afterAll(async () => {
    await connection.close();
  });

  it('should render bar chart from Malloy query', async () => {
    const malloyQuery = `
      source: test_data is table('duckdb:test_sales.parquet') {
        dimension: product
        measure: total is sum(revenue)
      }

      query: test_data -> {
        nest: by_product is {
          group_by: product
          aggregate: total
        } # nivo_bar_chart
      }
    `;

    const prepared = await runtime.loadQuery(malloyQuery);
    const result = await prepared.run();

    // Verify result structure
    expect(result.data).toBeDefined();
    expect(result.data.value).toHaveProperty('by_product');

    // Test rendering
    const html = await renderer.renderToHTML(result);
    expect(html).toContain('nivo_bar_chart');
  });

  it('should render pie chart from Malloy query', async () => {
    const malloyQuery = `
      source: test_data is table('duckdb:test_sales.parquet') {
        dimension: category
        measure: total is sum(revenue)
      }

      query: test_data -> {
        nest: by_category is {
          group_by: category
          aggregate: total
        } # nivo_pie_chart
      }
    `;

    const prepared = await runtime.loadQuery(malloyQuery);
    const result = await prepared.run();

    const html = await renderer.renderToHTML(result);
    expect(html).toContain('nivo_pie_chart');
  });
});
```

### Create Test Data

Create a test data generator `tests/integration/create-test-data.ts`:

```typescript
import * as duckdb from 'duckdb';
import { promisify } from 'util';

async function createTestData() {
  const db = new duckdb.Database(':memory:');
  const connection = db.connect();

  const run = promisify(connection.run.bind(connection));
  const all = promisify(connection.all.bind(connection));

  // Create test sales data
  await run(`
    CREATE TABLE test_sales AS
    SELECT * FROM (VALUES
      ('Product A', 'Electronics', 'North', 1000),
      ('Product B', 'Electronics', 'South', 1500),
      ('Product C', 'Clothing', 'North', 800),
      ('Product D', 'Clothing', 'South', 1200),
      ('Product E', 'Food', 'North', 600),
      ('Product F', 'Food', 'South', 900)
    ) AS t(product, category, region, revenue)
  `);

  // Export to parquet
  await run(`
    COPY test_sales TO 'test-data/test_sales.parquet' (FORMAT PARQUET)
  `);

  console.log('Test data created successfully');
}

createTestData().catch(console.error);
```

Run to create test data:

```bash
mkdir -p test-data
npx ts-node tests/integration/create-test-data.ts
```

### Run Integration Tests

```bash
npm test -- --testPathPattern=integration
```

## Manual Testing

### 1. Create a Test Application

Create `tests/manual/test-app.ts`:

```typescript
import { Runtime } from '@malloydata/malloy';
import { DuckDBConnection } from '@malloydata/db-duckdb';
import { MalloyRenderer } from '@malloydata/render';
import {
  NivoBarChartPluginFactory,
  NivoPieChartPluginFactory,
  NivoMarimekkoPluginFactory,
} from '../../src';
import * as fs from 'fs';

async function runTest() {
  console.log('Initializing Malloy runtime...');

  const connection = await DuckDBConnection.create({
    workingDirectory: './test-data',
  });

  const runtime = new Runtime({}, connection);

  const renderer = new MalloyRenderer({
    plugins: [
      NivoBarChartPluginFactory,
      NivoPieChartPluginFactory,
      NivoMarimekkoPluginFactory,
    ],
    pluginOptions: {
      nivo_bar_chart: {
        colorScheme: 'category10',
        showLegends: true,
      },
      nivo_pie_chart: {
        colorScheme: 'nivo',
        innerRadius: 0,
      },
      nivo_marimekko: {
        colorScheme: 'set3',
        layout: 'horizontal',
      },
    },
  });

  console.log('Running bar chart query...');
  const barChartQuery = `
    source: sales is table('duckdb:test_sales.parquet') {
      dimension: product, category, region
      measure: revenue is sum(revenue)
    }

    query: sales -> {
      nest: by_product is {
        group_by: product
        aggregate: revenue
      } # nivo_bar_chart
    }
  `;

  const barResult = await runtime.loadQuery(barChartQuery).then(q => q.run());
  const barHtml = await renderer.renderToHTML(barResult);
  fs.writeFileSync('tests/manual/output-bar-chart.html', wrapHtml(barHtml));
  console.log('Bar chart saved to output-bar-chart.html');

  console.log('Running pie chart query...');
  const pieChartQuery = `
    source: sales is table('duckdb:test_sales.parquet') {
      dimension: category
      measure: revenue is sum(revenue)
    }

    query: sales -> {
      nest: by_category is {
        group_by: category
        aggregate: revenue
      } # nivo_pie_chart
    }
  `;

  const pieResult = await runtime.loadQuery(pieChartQuery).then(q => q.run());
  const pieHtml = await renderer.renderToHTML(pieResult);
  fs.writeFileSync('tests/manual/output-pie-chart.html', wrapHtml(pieHtml));
  console.log('Pie chart saved to output-pie-chart.html');

  console.log('Running marimekko query...');
  const marimekkoQuery = `
    source: sales is table('duckdb:test_sales.parquet') {
      dimension: region, product
      measure: revenue is sum(revenue)
    }

    query: sales -> {
      nest: by_region is {
        group_by: region
        nest: by_product is {
          group_by: product
          aggregate: revenue
        }
      } # nivo_marimekko
    }
  `;

  const marimekkoResult = await runtime
    .loadQuery(marimekkoQuery)
    .then(q => q.run());
  const marimekkoHtml = await renderer.renderToHTML(marimekkoResult);
  fs.writeFileSync(
    'tests/manual/output-marimekko.html',
    wrapHtml(marimekkoHtml)
  );
  console.log('Marimekko chart saved to output-marimekko.html');

  await connection.close();
  console.log('Tests complete!');
}

function wrapHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nivo Plugin Test Output</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Nivo Plugin Test Output</h1>
    ${content}
  </div>
</body>
</html>
  `;
}

runTest().catch(console.error);
```

### 2. Run Manual Tests

```bash
# Run the test app
npx ts-node tests/manual/test-app.ts

# Open the generated HTML files in your browser
open tests/manual/output-bar-chart.html
open tests/manual/output-pie-chart.html
open tests/manual/output-marimekko.html
```

### 3. Visual Inspection Checklist

When reviewing the generated visualizations, check:

- [ ] Charts render without errors
- [ ] Data is correctly displayed
- [ ] Colors are applied properly
- [ ] Legends are visible and correct
- [ ] Tooltips work on hover
- [ ] Charts are responsive (try resizing browser)
- [ ] No console errors in browser dev tools
- [ ] Animations work smoothly (if enabled)

## Visual Testing

### Using Storybook for Visual Testing

Create `.storybook/main.ts`:

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: '@storybook/react-vite',
};

export default config;
```

Create story files for each plugin, e.g., `src/nivo-bar-chart-plugin.stories.tsx`:

```typescript
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ResponsiveBar } from '@nivo/bar';

const meta: Meta<typeof ResponsiveBar> = {
  title: 'Nivo/BarChart',
  component: ResponsiveBar,
};

export default meta;
type Story = StoryObj<typeof ResponsiveBar>;

const sampleData = [
  { product: 'Product A', revenue: 1000 },
  { product: 'Product B', revenue: 1500 },
  { product: 'Product C', revenue: 800 },
];

export const Default: Story = {
  args: {
    data: sampleData,
    keys: ['revenue'],
    indexBy: 'product',
    margin: { top: 50, right: 130, bottom: 50, left: 60 },
    padding: 0.3,
    colors: { scheme: 'nivo' },
  },
};

export const WithMultipleSeries: Story = {
  args: {
    data: [
      { product: 'Product A', revenue: 1000, profit: 300 },
      { product: 'Product B', revenue: 1500, profit: 500 },
      { product: 'Product C', revenue: 800, profit: 200 },
    ],
    keys: ['revenue', 'profit'],
    indexBy: 'product',
    margin: { top: 50, right: 130, bottom: 50, left: 60 },
    padding: 0.3,
    colors: { scheme: 'category10' },
  },
};
```

Run Storybook:

```bash
npm install --save-dev @storybook/react-vite
npm run storybook
```

## Testing Checklist

### Before Committing

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No TypeScript errors
- [ ] Code is properly formatted
- [ ] No console warnings in tests
- [ ] Test coverage is adequate (aim for >80%)

### Plugin Functionality

- [ ] Plugin matches correct field tags
- [ ] Plugin rejects invalid field types
- [ ] Data transformation works correctly
- [ ] React components render without errors
- [ ] Cleanup properly unmounts React roots
- [ ] Error handling displays user-friendly messages

### Visual Verification

- [ ] Charts render with correct data
- [ ] Colors and styling are applied
- [ ] Responsive behavior works
- [ ] Animations are smooth
- [ ] Tooltips display correctly
- [ ] Legends are positioned properly

## Common Issues and Debugging

### Issue: Plugin Not Matching

**Symptom**: Plugin doesn't render even with correct tag

**Debug Steps**:
1. Check tag syntax in Malloy query
2. Verify field type is RepeatedRecord
3. Check plugin registration in renderer
4. Add console.log in `matches()` method

```typescript
matches: (field, fieldTag, fieldType) => {
  console.log('Checking match:', {
    fieldName: field.name,
    hasTag: fieldTag.has('nivo_bar_chart'),
    fieldType: FieldType[fieldType]
  });
  // ... rest of matching logic
}
```

### Issue: React Not Rendering

**Symptom**: Blank container or error in console

**Debug Steps**:
1. Check browser console for errors
2. Verify React and ReactDOM versions
3. Check data transformation output
4. Test with simpler data first

```typescript
renderToDOM: (container, props) => {
  console.log('Rendering with data:', props.dataColumn);
  // ... rest of render logic
}
```

### Issue: Data Not Displaying Correctly

**Symptom**: Chart renders but shows wrong or no data

**Debug Steps**:
1. Log transformed data before passing to Nivo
2. Check field types match expectations
3. Verify null/undefined handling
4. Test with known good data

```typescript
const data = transformData(props);
console.log('Transformed data for Nivo:', data);
```

### Issue: Memory Leaks

**Symptom**: Performance degrades over time

**Debug Steps**:
1. Verify `cleanup()` is called
2. Check React root is unmounted
3. Use Chrome DevTools Memory profiler
4. Look for lingering event listeners

## Running All Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- nivo-bar-chart-plugin.test.ts

# Run in watch mode
npm test -- --watch

# Run with verbose output
npm test -- --verbose
```

## Continuous Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Test Nivo Plugins

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd examples/nivo-plugin && npm install
      - run: cd examples/nivo-plugin && npm test
      - run: cd examples/nivo-plugin && npm run build
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Malloy Testing Guide](https://malloydata.github.io/malloy/documentation/testing)
- [Nivo Testing Examples](https://github.com/plouc/nivo/tree/master/packages)

---

**Questions?** Open an issue on the [Malloy GitHub repository](https://github.com/malloydata/malloy/issues).
