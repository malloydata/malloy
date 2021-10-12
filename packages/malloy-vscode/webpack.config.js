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

const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const config = {
  target: "node",

  entry: {
    extension: "./src/extension/extension.ts",
    server: "./src/server/server.ts",
    query_web_view: "./src/webview/query/webview.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  devtool: "inline-source-map",
  externals: {
    vscode: "commonjs vscode",
  },
  resolve: {
    extensions: [".ts", ".js", ".svg", ".tsx"],
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
        test: /\.svg/,
        use: {
          loader: "file-loader",
        },
      },
      {
        test: /\.js$/,
        enforce: "pre",
        use: ["source-map-loader"],
      },
    ],
  },
  ignoreWarnings: [/Failed to parse source map/],
  plugins: [
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
};
module.exports = config;
