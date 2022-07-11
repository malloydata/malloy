/*
 * Copyright 2022 Google LLC
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

/* eslint-disable no-console */

import { serve } from "esbuild";
import { appDirectory, buildDirectory, commonAppConfig } from "./build";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";

async function doServe() {
  const { host, port } = await serve(
    {
      servedir: path.join(buildDirectory, appDirectory),
    },
    commonAppConfig(true)
  ).catch((e: unknown) => {
    console.log(e);
    process.exit(1);
  });

  // Hack to handle the fact that our packages directory is outside of the
  // paths understood by esbuild's serve(), so we need to load the sourcemaps
  // ourselves.
  http
    .createServer((req, res) => {
      const options = {
        hostname: host,
        port: port,
        path: req.url,
        method: req.method,
        headers: req.headers,
      };

      const proxyReq = http.request(options, (proxyRes) => {
        // If esbuild returns "not found", chec k
        if (proxyRes.statusCode === 404) {
          if (req.url) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            if (url.pathname.startsWith("/packages")) {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(fs.readFileSync(path.join('../..', url.pathname)));
              return;
            }
          }
        }

        // Otherwise, forward the response from esbuild to the client
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      // Forward the body of the request to esbuild
      req.pipe(proxyReq, { end: true });
    })
    .listen(3000);
}

doServe();
