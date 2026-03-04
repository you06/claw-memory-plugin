import { connect, type Connection } from "@tidbcloud/serverless";
import type { TiDBConnectionConfig } from "./config.js";

export type { Connection };

/** Create a new TiDB Serverless connection from plugin config. */
export function createConnection(cfg: TiDBConnectionConfig): Connection {
  return connect({
    host: cfg.host,
    username: cfg.user,
    password: cfg.password,
    database: cfg.database,
  });
}

/** Run a SELECT query and return typed rows. */
export async function query<T = Record<string, unknown>>(
  conn: Connection,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await conn.execute(sql, params);
  return (result as unknown as T[]) ?? [];
}

/** Run an INSERT / UPDATE / DELETE statement. */
export async function execute(
  conn: Connection,
  sql: string,
  params?: unknown[],
): Promise<void> {
  await conn.execute(sql, params);
}

/**
 * Initialize the database and memories table.
 * The VECTOR dimension is derived from the configured embedding model.
 */
export async function initSchema(
  conn: Connection,
  database: string,
  vectorDims: number,
): Promise<void> {
  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error(
      `Invalid database name "${database}": must contain only alphanumeric characters and underscores`,
    );
  }
  if (!Number.isInteger(vectorDims) || vectorDims <= 0) {
    throw new Error(
      `Invalid vectorDims "${vectorDims}": must be a positive integer`,
    );
  }

  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await conn.execute(`USE \`${database}\``);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS memories (
      id VARCHAR(36) PRIMARY KEY,
      content TEXT NOT NULL,
      source VARCHAR(100),
      tags JSON,
      metadata JSON,
      embedding VECTOR(${vectorDims}),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_source (source)
    )
  `);
}
