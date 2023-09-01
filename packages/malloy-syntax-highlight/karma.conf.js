// Karma configuration
// Generated on Fri Aug 25 2023 22:55:21 GMT+0000 (Coordinated Universal Time)

module.exports = function (config) {
  config.set({
    client: {
      clearContext: false,
      jasmine: {
        random: false,
        timeoutInterval: 10000,
      },
    },
    basePath: '',
    // frameworks to use
    // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
    frameworks: ['jasmine'],
    // list of files / patterns to load in the browser
    files: [
      { pattern: 'node_modules/monaco-editor/min/vs/**', included: false },
      { pattern: 'node_modules/monaco-editor/min-maps/vs/**', included: false },
      { pattern: 'dist/**/*.test.js', type: 'module' },
      { pattern: 'dist/**/*.js', included: false },
    ],
    // list of files / patterns to exclude
    exclude: [],
    plugins: [
      // require('karma-webpack'),
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-spec-reporter'),
      require('karma-jasmine-html-reporter'),
    ],
    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
    reporters: ['spec', 'kjhtml'],
    // web server port
    port: 9876,
    // enable / disable colors in the output (reporters and logs)
    colors: true,
    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,
    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,
    // start these browsers
    // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
    browsers: ['Chrome'],
    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,
    // Concurrency level
    // how many browser instances should be started simultaneously
    concurrency: Infinity,
  });
};
