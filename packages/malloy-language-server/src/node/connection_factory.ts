/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy-connections';
import '@malloydata/db-publisher';
import type {ConnectionFactory} from '../common/connections/types';

/**
 * Node connection factory. The side-effect imports above register backend
 * connection types with the malloy registry. No additional methods needed —
 * discovery and working-directory injection are now handled by core's
 * discoverConfig and contextOverlay.
 */
export class NodeConnectionFactory implements ConnectionFactory {}
