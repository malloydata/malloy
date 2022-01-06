/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

"use strict";
const webpack = require("webpack");

const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const config = [
  {
    target: "node",

    entry: {
      extension: "./src/extension/extension.ts",
      server: "./src/server/server.ts",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      libraryTarget: "commonjs2",
      devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    devtool: "inline-cheap-module-source-map",
    externals: {
      vscode: "commonjs vscode",
    },
    resolve: {
      extensions: [".ts", ".js", ".svg"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "ts-loader",
              options: {
                projectReferences: true,
              },
            },
          ],
        },
        {
          test: /\.svg/,
          use: {
            loader: "file-loader",
          },
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          enforce: "pre",
          use: ["source-map-loader"],
        },
      ],
    },
    plugins: [
      new webpack.IgnorePlugin({ resourceRegExp: /^pg-native$/ }),
      new CopyPlugin({
        patterns: [
          {
            from: "language.json",
            to: "language.json",
          },
          {
            from: "src/media/refresh.svg",
            to: "src/media/refresh.svg",
          },
          {
            from: "src/media/play.svg",
            to: "src/media/play.svg",
          },
        ],
      }),
    ],
  },
  {
    target: "web",
    entry: {
      query_webview: "./src/extension/webviews/query_page/entry.ts",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      libraryTarget: "umd",
      devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    devtool: "inline-cheap-module-source-map",
    resolve: {
      extensions: [".ts", ".js", ".tsx"],
      fallback: {
        fs: false,
        stream: false,
        assert: false,
        util: false,
        events: false,
        http: false,
        https: false,
        tls: false,
        net: false,
        crypto: false,
        url: false,
        buffer: false,
        zlib: false,
        querystring: false,
        path: false,
        os: false,
        child_process: false,
        process: false,
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "ts-loader",
              options: {
                projectReferences: true,
              },
            },
          ],
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          enforce: "pre",
          use: ["source-map-loader"],
        },
        {
          test: /\.svg$/,
          use: [
            {
              loader: "babel-loader",
            },
            {
              loader: "react-svg-loader",
              options: {
                jsx: true,
              },
            },
          ],
        },
      ],
    },
  },
];
module.exports = config;
