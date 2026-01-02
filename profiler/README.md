# Malloy Stable Request Profiler

This package enables profiling of the Malloy compiler. Currently it only works with stateless compilation of queries. In the future we can extend it to support other kinds of compilation.

## Usage

### Basic timing (100 iterations with average):
```bash
npm run time path/to/file.json
```

### Detailed flame graph profiling:
```bash
npm run profile path/to/file.json
```

This creates a `.cpuprofile` file and provides instructions for viewing the flame graph in Chrome DevTools.

To view the flame graph:
1. Open Chrome and navigate to `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Go to the Performance tab
4. Load the generated `.cpuprofile` file
