#!/usr/bin/env python3
"""
GizmoSQL Bridge - ADBC-based Flight SQL client for Node.js
Uses Apache Arrow Database Connectivity (ADBC) which properly handles GizmoSQL
"""

import sys
import json
import re
import pyarrow as pa
from adbc_driver_flightsql import dbapi as flightsql, DatabaseOptions


def validate_identifier(identifier: str) -> str:
    """Validate SQL identifier to prevent injection attacks"""
    if not identifier:
        raise ValueError("Identifier cannot be empty")

    # Allow alphanumeric, underscores, hyphens, and periods (for qualified names)
    # Must start with letter or underscore
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_.-]*$', identifier):
        raise ValueError(f"Invalid identifier: {identifier}")

    return identifier


def execute_query(uri: str, username: str, password: str, catalog: str, sql: str) -> dict:
    """Execute SQL query and return Arrow IPC data"""
    try:
        # Validate catalog to prevent SQL injection
        safe_catalog = validate_identifier(catalog)

        # Connect with ADBC
        conn = flightsql.connect(
            uri=uri,
            db_kwargs={
                "username": username,
                "password": password,
                DatabaseOptions.WITH_COOKIE_MIDDLEWARE.value: "true",
            },
            conn_kwargs={
                "adbc.connection.catalog": safe_catalog,
            },
        )

        with conn.cursor() as cursor:
            # CRITICAL: GizmoSQL requires USE catalog before each query
            cursor.execute(f"USE {safe_catalog}")
            cursor.execute(sql)

            # Fetch as Arrow table
            table = cursor.fetch_arrow_table()

            # Serialize to Arrow IPC format
            sink = pa.BufferOutputStream()
            writer = pa.ipc.new_stream(sink, table.schema)
            writer.write_table(table)
            writer.close()

            # Return base64-encoded Arrow IPC
            ipc_bytes = sink.getvalue().to_pybytes()

        conn.close()

        return {
            "success": True,
            "data": ipc_bytes.hex(),  # Hex encoding for JSON safety
            "num_rows": len(table),
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


def main():
    """Read request from stdin, execute query, write response to stdout"""
    try:
        # Read request from stdin
        request_json = sys.stdin.read()
        request = json.loads(request_json)

        # Execute query
        result = execute_query(
            uri=request["uri"],
            username=request["username"],
            password=request["password"],
            catalog=request["catalog"],
            sql=request["sql"],
        )

        # Write response to stdout
        print(json.dumps(result), flush=True)

    except Exception as e:
        error_result = {
            "success": False,
            "error": f"Bridge error: {str(e)}",
        }
        print(json.dumps(error_result), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
