// vite.config.mts
import { mergeConfig } from "file:///Users/cswenson/Documents/malloy/node_modules/vite/dist/node/index.js";

// vite.config.base.mts
import { defineConfig } from "file:///Users/cswenson/Documents/malloy/node_modules/vite/dist/node/index.js";
import solidPlugin from "file:///Users/cswenson/Documents/malloy/packages/malloy-render/node_modules/vite-plugin-solid/dist/esm/index.mjs";
import tsconfigPaths from "file:///Users/cswenson/Documents/malloy/node_modules/vite-tsconfig-paths/dist/index.js";
import dts from "file:///Users/cswenson/Documents/malloy/node_modules/vite-plugin-dts/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "/Users/cswenson/Documents/malloy/packages/malloy-render";
var vite_config_base_default = defineConfig({
  plugins: [
    viteStripMalloyDevToolsPlugin(),
    solidPlugin(),
    tsconfigPaths(),
    dts({
      insertTypesEntry: true
    })
  ],
  optimizeDeps: {
    include: ["@malloydata/malloy"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    rollupOptions: {
      external: [],
      output: {}
    },
    commonjsOptions: {
      include: [/malloy/, /node_modules/]
    }
  },
  define: {
    "process.env": {}
  }
});
function viteStripMalloyDevToolsPlugin() {
  return {
    name: "vite-plugin-strip-malloy-dev-tools",
    async transform(code, id) {
      if (id.endsWith("chart-dev-tool.tsx")) {
        return `
        export default function noop() {
          return null;
        }
        `;
      }
    }
  };
}

// vite.config.mts
var vite_config_default = mergeConfig(vite_config_base_default, {
  build: {
    lib: {
      entry: "src/index.ts",
      name: "index",
      fileName: "index"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubXRzIiwgInZpdGUuY29uZmlnLmJhc2UubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2Nzd2Vuc29uL0RvY3VtZW50cy9tYWxsb3kvcGFja2FnZXMvbWFsbG95LXJlbmRlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2Nzd2Vuc29uL0RvY3VtZW50cy9tYWxsb3kvcGFja2FnZXMvbWFsbG95LXJlbmRlci92aXRlLmNvbmZpZy5tdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2Nzd2Vuc29uL0RvY3VtZW50cy9tYWxsb3kvcGFja2FnZXMvbWFsbG95LXJlbmRlci92aXRlLmNvbmZpZy5tdHNcIjtpbXBvcnQge21lcmdlQ29uZmlnfSBmcm9tICd2aXRlJztcbmltcG9ydCBiYXNlVml0ZUNvbmZpZyBmcm9tICcuL3ZpdGUuY29uZmlnLmJhc2UubXRzJztcblxuZXhwb3J0IGRlZmF1bHQgbWVyZ2VDb25maWcoYmFzZVZpdGVDb25maWcsIHtcbiAgYnVpbGQ6IHtcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiAnc3JjL2luZGV4LnRzJyxcbiAgICAgIG5hbWU6ICdpbmRleCcsXG4gICAgICBmaWxlTmFtZTogJ2luZGV4JyxcbiAgICB9LFxuICB9LFxufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9jc3dlbnNvbi9Eb2N1bWVudHMvbWFsbG95L3BhY2thZ2VzL21hbGxveS1yZW5kZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9jc3dlbnNvbi9Eb2N1bWVudHMvbWFsbG95L3BhY2thZ2VzL21hbGxveS1yZW5kZXIvdml0ZS5jb25maWcuYmFzZS5tdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2Nzd2Vuc29uL0RvY3VtZW50cy9tYWxsb3kvcGFja2FnZXMvbWFsbG95LXJlbmRlci92aXRlLmNvbmZpZy5iYXNlLm10c1wiO2ltcG9ydCB0eXBlIHtQbHVnaW5PcHRpb259IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHtkZWZpbmVDb25maWd9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHNvbGlkUGx1Z2luIGZyb20gJ3ZpdGUtcGx1Z2luLXNvbGlkJztcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gJ3ZpdGUtdHNjb25maWctcGF0aHMnO1xuaW1wb3J0IGR0cyBmcm9tICd2aXRlLXBsdWdpbi1kdHMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICB2aXRlU3RyaXBNYWxsb3lEZXZUb29sc1BsdWdpbigpLFxuICAgIHNvbGlkUGx1Z2luKCksXG4gICAgdHNjb25maWdQYXRocygpLFxuICAgIGR0cyh7XG4gICAgICBpbnNlcnRUeXBlc0VudHJ5OiB0cnVlLFxuICAgIH0pLFxuICBdLFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ0BtYWxsb3lkYXRhL21hbGxveSddLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBleHRlcm5hbDogW10sXG4gICAgICBvdXRwdXQ6IHt9LFxuICAgIH0sXG4gICAgY29tbW9uanNPcHRpb25zOiB7XG4gICAgICBpbmNsdWRlOiBbL21hbGxveS8sIC9ub2RlX21vZHVsZXMvXSxcbiAgICB9LFxuICB9LFxuICBkZWZpbmU6IHtcbiAgICAncHJvY2Vzcy5lbnYnOiB7fSxcbiAgfSxcbn0pO1xuXG5mdW5jdGlvbiB2aXRlU3RyaXBNYWxsb3lEZXZUb29sc1BsdWdpbigpOiBQbHVnaW5PcHRpb24ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICd2aXRlLXBsdWdpbi1zdHJpcC1tYWxsb3ktZGV2LXRvb2xzJyxcbiAgICBhc3luYyB0cmFuc2Zvcm0oY29kZSwgaWQpIHtcbiAgICAgIGlmIChpZC5lbmRzV2l0aCgnY2hhcnQtZGV2LXRvb2wudHN4JykpIHtcbiAgICAgICAgcmV0dXJuIGBcbiAgICAgICAgZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gbm9vcCgpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBgO1xuICAgICAgfVxuICAgIH0sXG4gIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlWLFNBQVEsbUJBQWtCOzs7QUNDblgsU0FBUSxvQkFBbUI7QUFDM0IsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxtQkFBbUI7QUFDMUIsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sVUFBVTtBQUxqQixJQUFNLG1DQUFtQztBQU96QyxJQUFPLDJCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCw4QkFBOEI7QUFBQSxJQUM5QixZQUFZO0FBQUEsSUFDWixjQUFjO0FBQUEsSUFDZCxJQUFJO0FBQUEsTUFDRixrQkFBa0I7QUFBQSxJQUNwQixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLG9CQUFvQjtBQUFBLEVBQ2hDO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixVQUFVLENBQUM7QUFBQSxNQUNYLFFBQVEsQ0FBQztBQUFBLElBQ1g7QUFBQSxJQUNBLGlCQUFpQjtBQUFBLE1BQ2YsU0FBUyxDQUFDLFVBQVUsY0FBYztBQUFBLElBQ3BDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sZUFBZSxDQUFDO0FBQUEsRUFDbEI7QUFDRixDQUFDO0FBRUQsU0FBUyxnQ0FBOEM7QUFDckQsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sTUFBTSxVQUFVLE1BQU0sSUFBSTtBQUN4QixVQUFJLEdBQUcsU0FBUyxvQkFBb0IsR0FBRztBQUNyQyxlQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUtUO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjs7O0FEaERBLElBQU8sc0JBQVEsWUFBWSwwQkFBZ0I7QUFBQSxFQUN6QyxPQUFPO0FBQUEsSUFDTCxLQUFLO0FBQUEsTUFDSCxPQUFPO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixVQUFVO0FBQUEsSUFDWjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
