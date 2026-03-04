import { type Connection, query, execute } from "./db.js";
import { type Embeddings, vectorToString } from "./embedding.js";

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
  embedding?: string | null;
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
  private embeddings: Embeddings | null;

  constructor(conn: Connection, embeddings?: Embeddings);
  constructor(private conn: Connection, embeddings?: Embeddings) {
    this.embeddings = embeddings ?? null;
  }

  /** Insert a single memory. Auto-generates embedding when available. */
  async store(
    entry: CreateMemoryEntry,
    embedding?: string | null,
  ): Promise<Memory> {
    const id = generateId();

    // Auto-generate embedding if not provided and Embeddings is configured
    let embeddingStr = embedding ?? null;
    if (embeddingStr === null && this.embeddings) {
      const vec = await this.embeddings.embed(entry.content);
      embeddingStr = vectorToString(vec);
    }

    await execute(
      this.conn,
      `INSERT INTO memories (id, content, source, tags, metadata, embedding)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.content,
        entry.source ?? null,
        entry.tags ? JSON.stringify(entry.tags) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        embeddingStr,
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
   * Search memories. Uses vector search when embeddings are available,
   * falls back to text LIKE search otherwise.
   */
  async search(q: string, limit = 50): Promise<Memory[]> {
    if (this.embeddings) {
      const vec = await this.embeddings.embed(q);
      const results = await this.searchVector(vectorToString(vec), limit);
      return results;
    }

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

  /** Vector similarity search using VEC_COSINE_DISTANCE. */
  async searchVector(
    vector: string,
    limit = 50,
  ): Promise<(Memory & { distance: number })[]> {
    const rows = await query<Record<string, unknown>>(
      this.conn,
      `SELECT *, VEC_COSINE_DISTANCE(embedding, ?) AS distance
       FROM memories
       WHERE embedding IS NOT NULL
       ORDER BY distance ASC
       LIMIT ?`,
      [vector, limit],
    );
    return rows.map((r) => ({
      ...formatRow(r),
      distance: r.distance as number,
    }));
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
   * Re-generates embedding when content changes and Embeddings is configured.
   */
  async update(id: string, fields: UpdateMemoryFields): Promise<Memory | null> {
    // Re-generate embedding when content changes and no explicit embedding provided
    if (fields.content !== undefined && fields.embedding === undefined && this.embeddings) {
      const vec = await this.embeddings.embed(fields.content);
      fields.embedding = vectorToString(vec);
    }

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
    if (fields.embedding !== undefined) {
      sets.push("embedding = ?");
      values.push(fields.embedding);
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
   * Bulk insert memories. Auto-generates embeddings when available.
   * `embeddings` is an optional parallel array of vector strings.
   * Returns the number of rows inserted.
   */
  async bulkStore(
    entries: CreateMemoryEntry[],
    embeddings?: (string | null)[],
  ): Promise<number> {
    // Auto-generate embeddings if not provided and Embeddings is configured
    let embeddingStrs = embeddings;
    if (!embeddingStrs && this.embeddings && entries.length > 0) {
      const texts = entries.map((e) => e.content);
      const vecs = await this.embeddings.embedBatch(texts);
      embeddingStrs = vecs.map((vec) => vectorToString(vec));
    }

    let inserted = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const embedding = embeddingStrs?.[i] ?? null;
      const id = generateId();
      await execute(
        this.conn,
        `INSERT INTO memories (id, content, source, tags, metadata, embedding)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          entry.content,
          entry.source ?? null,
          entry.tags ? JSON.stringify(entry.tags) : null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          embedding,
        ],
      );
      inserted++;
    }
    return inserted;
  }
}
