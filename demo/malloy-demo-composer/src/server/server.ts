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

import express from "express";
import { routes } from "./routes";
import cors from "cors";
import * as path from "path";
import logging from "./logging";

const app = express();

const DEV = process.env.DEV === "1";
const PORT = (process.env.PORT || 4000) as number;
const HOST = process.env.HOST || "localhost";

const allowedOrigins = [];

if (DEV) {
  // eslint-disable-next-line no-console
  console.log("DEV Enabled");
  allowedOrigins.push(`http://${HOST}:${PORT}`);
}

app.use(logging.basicLogging);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const router = express.Router();

routes(router);

app.use("/api", router);

const BUILD_ROOT = path.join(__dirname, "../build");

app.use("/static", express.static(path.join(BUILD_ROOT, "/app")));

app.use("/fonts", express.static(path.join(BUILD_ROOT, "/app/fonts")));

app.use("/", express.static(path.join(BUILD_ROOT, "/app")));

if (DEV) {
  app.use(
    "/packages",
    express.static(path.join(BUILD_ROOT, "../../../packages"))
  );
}

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
