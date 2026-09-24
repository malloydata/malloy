/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AthenaConnectionConfiguration} from './athena_runner';

export class AthenaExecutor {
  /**
   * The test rig's connection, from ATHENA_* environment variables; undefined
   * when ATHENA_WORKGROUP is unset. Credentials are the SDK's default chain
   * (AWS_PROFILE, environment keys, an instance or pod role), never read here.
   */
  public static getConnectionOptionsFromEnv():
    AthenaConnectionConfiguration | undefined {
    const workGroup = process.env['ATHENA_WORKGROUP'];
    if (!workGroup) {
      return undefined;
    }
    const reuseMinutes = process.env['ATHENA_RESULT_REUSE_MINUTES'];
    return {
      workGroup,
      region: process.env['ATHENA_REGION'],
      catalog: process.env['ATHENA_CATALOG'],
      database: process.env['ATHENA_DATABASE'],
      outputLocation: process.env['ATHENA_OUTPUT_LOCATION'],
      resultReuseMaxAgeMinutes: reuseMinutes ? Number(reuseMinutes) : undefined,
    };
  }
}
