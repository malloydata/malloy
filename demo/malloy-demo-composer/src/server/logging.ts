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

import * as express from "express";

class logging {
  basicLogging(req: express.Request, res: express.Response, next: () => void) {
    // eslint-disable-next-line no-console
    console.log(
      `${req.ip} - [${new Date().toISOString()}] ${res.statusCode} ${
        req.method
      } ${req.path}`
    );
    next();
  }
}

export default new logging();
