import { type Connection, query, execute } from "./db.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Memory {
  id: string;
  content: string;
  source: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoryEntry {
  content: string;
  source?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryFields {
  content?: string;
  source?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Parse JSON string fields returned by TiDB into JS objects. */
function formatRow(row: Record<string, unknown>): Memory {
  const tags = row.tags;
  const metadata = row.metadata;
  return {
    id: row.id as string,
    content: row.content as string,
    source: (row.source as string) ?? null,
    tags: typeof tags === "string" ? JSON.parse(tags) : (tags as string[] | null),
    metadata:
      typeof metadata === "string"
        ? JSON.parse(metadata)
        : (metadata as Record<string, unknown> | null),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// MemoryStore
// ---------------------------------------------------------------------------

export class MemoryStore {
  constructor(private conn: Connection) {}

  /** Insert a single memory. */
  async store(entry: CreateMemoryEntry): Promise<Memory> {
    const id = generateId();

    await execute(
      this.conn,
      `INSERT INTO memories (id, content, source, tags, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        entry.content,
        entry.source ?? null,
        entry.tags ? JSON.stringify(entry.tags) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    );

    const rows = await query<Record<string, unknown>>(
      this.conn,
      "SELECT * FROM memories WHERE id = ?",
      [id],
    );
    return formatRow(rows[0]);
  }

  /**
   * Search memories. Uses TiDB Auto Embedding when available,
   * falls back to text LIKE search otherwise.
   */
  async search(q: string, limit = 50): Promise<Array<Memory & { distance?: number }>> {
    try {
      const rows = await query<Record<string, unknown>>(
        this.conn,
        `SELECT *, VEC_EMBED_COSINE_DISTANCE(content_vector, ?) AS distance
         FROM memories
         ORDER BY distance ASC
         LIMIT ?`,
        [q, limit],
      );
      return rows.map((r) => ({
        ...formatRow(r),
        distance: Number(r.distance),
      }));
    } catch {
      // Fallback: text search using LIKE
      const rows = await query<Record<string, unknown>>(
        this.conn,
        `SELECT * FROM memories
         WHERE content LIKE CONCAT('%', ?, '%')
         ORDER BY updated_at DESC
         LIMIT ?`,
        [q, limit],
      );
      return rows.map(formatRow);
    }
  }

  /** Get a single memory by id. Returns null if not found. */
  async get(id: string): Promise<Memory | null> {
    const rows = await query<Record<string, unknown>>(
      this.conn,
      "SELECT * FROM memories WHERE id = ?",
      [id],
    );
    return rows.length > 0 ? formatRow(rows[0]) : null;
  }

  /**
   * Update selected fields of a memory.
   */
  async update(id: string, fields: UpdateMemoryFields): Promise<Memory | null> {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.content !== undefined) {
      sets.push("content = ?");
      values.push(fields.content);
    }
    if (fields.source !== undefined) {
      sets.push("source = ?");
      values.push(fields.source);
    }
    if (fields.tags !== undefined) {
      sets.push("tags = ?");
      values.push(JSON.stringify(fields.tags));
    }
    if (fields.metadata !== undefined) {
      sets.push("metadata = ?");
      values.push(JSON.stringify(fields.metadata));
    }

    if (sets.length === 0) return this.get(id);

    await execute(
      this.conn,
      `UPDATE memories SET ${sets.join(", ")} WHERE id = ?`,
      [...values, id],
    );

    return this.get(id);
  }

  /** Delete a memory by id. Returns true if a row was found and deleted. */
  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id);
    if (!existing) return false;
    await execute(this.conn, "DELETE FROM memories WHERE id = ?", [id]);
    return true;
  }

  /** Count total memories. */
  async count(): Promise<number> {
    const rows = await query<{ cnt: number }>(
      this.conn,
      "SELECT COUNT(*) AS cnt FROM memories",
    );
    return rows[0]?.cnt ?? 0;
  }

  /**
   * Bulk insert memories.
   * Returns the number of rows inserted.
   */
  async bulkStore(entries: CreateMemoryEntry[]): Promise<number> {
    let inserted = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const id = generateId();
      await execute(
        this.conn,
        `INSERT INTO memories (id, content, source, tags, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          entry.content,
          entry.source ?? null,
          entry.tags ? JSON.stringify(entry.tags) : null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        ],
      );
      inserted++;
    }
    return inserted;
  }
}
