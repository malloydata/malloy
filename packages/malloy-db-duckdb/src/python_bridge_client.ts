/*
 * Copyright 2025 Google LLC
 *
 * Python bridge client for GizmoSQL
 * Uses Python ADBC driver which properly handles GizmoSQL's Flight SQL implementation
 */

import {spawn} from 'child_process';
import {Table, tableFromIPC} from 'apache-arrow';
import {join} from 'path';

export interface PythonBridgeConfig {
  uri: string;
  username: string;
  password: string;
  catalog: string;
  pythonPath?: string;
}

export class PythonBridgeClient {
  private config: PythonBridgeConfig;

  constructor(config: PythonBridgeConfig) {
    this.config = config;
  }

  /**
   * Execute SQL query via Python ADBC bridge
   * Returns Apache Arrow Table
   */
  async query(sql: string): Promise<Table> {
    const request = {
      uri: this.config.uri,
      username: this.config.username,
      password: this.config.password,
      catalog: this.config.catalog,
      sql,
    };

    const pythonPath = this.config.pythonPath || 'python3';
    const bridgeScript = join(__dirname, '../python/gizmosql_bridge.py');

    return new Promise<Table>((resolve, reject) => {
      const python = spawn(pythonPath, [bridgeScript]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          const error = new Error(
            `Python bridge failed (code ${code}): ${stderr}`
          );
          reject(error);
          return;
        }

        try {
          const response = JSON.parse(stdout);

          if (!response.success) {
            reject(new Error(`Query failed: ${response.error}`));
            return;
          }

          // Decode hex-encoded Arrow IPC data
          const ipcBuffer = Buffer.from(response.data, 'hex');

          // Parse into Arrow Table
          const table = tableFromIPC(ipcBuffer);

          resolve(table);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          reject(new Error(`Failed to parse bridge response: ${message}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python: ${error.message}`));
      });

      // Send request to Python stdin
      python.stdin.write(JSON.stringify(request));
      python.stdin.end();
    });
  }

  async connect(): Promise<void> {
    // No persistent connection needed - Python handles it per-query
  }

  close(): void {
    // No cleanup needed for stateless client
  }
}
