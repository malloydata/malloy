# Testing

The `malloy-filter` tests use Jest.

```bash
npm run build
npm run test
```

# generate_samples

The `generate_samples.ts` script creates the suite of examples in ../SAMPLES.md.  As such, it is also a terrific tool for testing and validating changes to any of the parsers.  Feel free to add new examples to `generate_samples.ts` as new features are added to the parsers.

To create the samples:

```bash
npm run build
npm run samples
```
