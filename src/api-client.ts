export interface ClaimResponse {
  token: string;
  claim_url: string;
  zero_id: string;
  expires_at: string;
  message: string;
}

export interface TokenInfo {
  token: string;
  created_at: string;
  expires_at: string;
  has_client_key: boolean;
  claim_url?: string;
}

export interface CreateTokenResponse {
  token: string;
  created_at: string;
  expires_at: string;
  has_client_key: boolean;
  claim_url: string;
}

export interface ApiMemory {
  id: string;
  content: string;
  source: string | null;
  tags: string[] | null;
  key: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface StoreMemoryParams {
  content: string;
  source?: string;
  tags?: string[];
  key?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchMemoriesParams {
  q?: string;
  tags?: string;
  source?: string;
  key?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_BASE_URL = "https://claw-memory.siddontang.workers.dev";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`API request failed (${status}): ${body}`);
    this.name = "ApiError";
  }
}

/** Client for the claw-memory Cloudflare Worker API. */
export class ClawMemoryApiClient {
  private baseUrl: string;
  private token: string | undefined;
  private encryptionKey: string | undefined;

  constructor(baseUrl?: string, token?: string, encryptionKey?: string) {
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.token = token;
    this.encryptionKey = encryptionKey;
  }

  private headers(auth = false): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.encryptionKey) {
      h["X-Encryption-Key"] = this.encryptionKey;
    }
    if (auth && this.token) {
      h["Authorization"] = `Bearer ${this.token}`;
    }
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(auth),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new ApiError(res.status, text);
    }

    return JSON.parse(text) as T;
  }

  /** Create a new memory space token. */
  async createToken(): Promise<CreateTokenResponse> {
    return this.request<CreateTokenResponse>("POST", "/api/tokens");
  }

  /** Get info and stats for a token. */
  async getTokenInfo(token: string): Promise<TokenInfo> {
    return this.request<TokenInfo>("GET", `/api/tokens/${encodeURIComponent(token)}/info`);
  }

  /** Generate a claim URL for an existing token. */
  async claimToken(token: string): Promise<ClaimResponse> {
    return this.request<ClaimResponse>("POST", `/api/tokens/${encodeURIComponent(token)}/claim`);
  }

  // ========================================================================
  // Memory CRUD (requires token auth)
  // ========================================================================

  /** Store a memory. */
  async storeMemory(params: StoreMemoryParams): Promise<{ ok: boolean; data: ApiMemory }> {
    return this.request("POST", "/api/memories", params, true);
  }

  /** Search/list memories. */
  async searchMemories(params?: SearchMemoriesParams): Promise<{ ok: boolean; data: ApiMemory[] }> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.tags) qs.set("tags", params.tags);
    if (params?.source) qs.set("source", params.source);
    if (params?.key) qs.set("key", params.key);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return this.request("GET", `/api/memories${query ? `?${query}` : ""}`, undefined, true);
  }

  /** Get a single memory by id. */
  async getMemory(id: string): Promise<{ ok: boolean; data: ApiMemory }> {
    return this.request("GET", `/api/memories/${encodeURIComponent(id)}`, undefined, true);
  }

  /** Delete a memory by id. */
  async deleteMemory(id: string): Promise<{ ok: boolean }> {
    return this.request("DELETE", `/api/memories/${encodeURIComponent(id)}`, undefined, true);
  }
}
