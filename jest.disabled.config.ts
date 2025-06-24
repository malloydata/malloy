// TODO remove this when we've resolved path resolution
module.exports = {
  ...require('./jest.config.ts'),
  roots: ['<rootDir>/packages/malloy-render/'],
};
