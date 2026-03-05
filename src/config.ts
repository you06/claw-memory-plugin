export type TiDBConnectionConfig = {
  host: string;
  user: string;
  password: string;
  database: string;
};

export type ApiConnectionConfig = {
  apiUrl: string;
  token: string;
  encryptionKey?: string;
};

type BaseMemoryConfig = {
  autoCapture: boolean;
  autoRecall: boolean;
  captureMaxChars: number;
};

export type DirectMemoryConfig = BaseMemoryConfig & {
  mode: "direct";
  tidb: TiDBConnectionConfig;
};

export type ApiMemoryConfig = BaseMemoryConfig & {
  mode: "api";
  api: ApiConnectionConfig;
};

export type MemoryConfig = DirectMemoryConfig | ApiMemoryConfig;

export const MEMORY_CATEGORIES = ["preference", "fact", "decision", "entity", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const DEFAULT_CAPTURE_MAX_CHARS = 500;

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) {
    return;
  }
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

const DIRECT_KEYS = ["host", "user", "password", "database"];
const API_KEYS = ["apiUrl", "token", "encryptionKey"];
const SHARED_KEYS = ["autoCapture", "autoRecall", "captureMaxChars"];
const ALL_ALLOWED_KEYS = [...DIRECT_KEYS, ...API_KEYS, ...SHARED_KEYS];

export const memoryConfigSchema = {
  parse(value: unknown): MemoryConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ALL_ALLOWED_KEYS, "memory config");

    // Detect mode
    const hasDirectKeys = DIRECT_KEYS.some((k) => k in cfg);
    const hasApiKeys = API_KEYS.some((k) => k in cfg && k !== "encryptionKey");

    if (hasDirectKeys && hasApiKeys) {
      throw new Error(
        "Direct mode (host/user/password/database) and API mode (apiUrl/token) are mutually exclusive",
      );
    }
    if (!hasDirectKeys && !hasApiKeys) {
      throw new Error(
        "Either direct mode (host/user/password/database) or API mode (apiUrl/token) must be configured",
      );
    }

    const captureMaxChars =
      typeof cfg.captureMaxChars === "number" ? Math.floor(cfg.captureMaxChars) : undefined;
    if (
      typeof captureMaxChars === "number" &&
      (captureMaxChars < 100 || captureMaxChars > 10_000)
    ) {
      throw new Error("captureMaxChars must be between 100 and 10000");
    }

    const shared = {
      autoCapture: cfg.autoCapture === true,
      autoRecall: cfg.autoRecall !== false,
      captureMaxChars: captureMaxChars ?? DEFAULT_CAPTURE_MAX_CHARS,
    };

    if (hasApiKeys) {
      if (typeof cfg.apiUrl !== "string" || !cfg.apiUrl) {
        throw new Error("apiUrl is required for API mode");
      }
      if (typeof cfg.token !== "string" || !cfg.token) {
        throw new Error("token is required for API mode");
      }
      if (cfg.encryptionKey !== undefined && typeof cfg.encryptionKey !== "string") {
        throw new Error("encryptionKey must be a string");
      }
      return {
        mode: "api",
        api: {
          apiUrl: cfg.apiUrl as string,
          token: resolveEnvVars(cfg.token as string),
          ...(cfg.encryptionKey ? { encryptionKey: resolveEnvVars(cfg.encryptionKey as string) } : {}),
        },
        ...shared,
      };
    }

    // Direct mode
    if (typeof cfg.host !== "string" || !cfg.host) {
      throw new Error("host is required");
    }
    if (typeof cfg.user !== "string" || !cfg.user) {
      throw new Error("user is required");
    }
    if (typeof cfg.password !== "string" || !cfg.password) {
      throw new Error("password is required");
    }
    if (typeof cfg.database !== "string" || !cfg.database) {
      throw new Error("database is required");
    }

    return {
      mode: "direct",
      tidb: {
        host: resolveEnvVars(cfg.host as string),
        user: resolveEnvVars(cfg.user as string),
        password: resolveEnvVars(cfg.password as string),
        database: resolveEnvVars(cfg.database as string),
      },
      ...shared,
    };
  },
  uiHints: {
    apiUrl: {
      label: "API URL",
      placeholder: "https://claw-memory.example.workers.dev",
      help: "Worker API endpoint (use this OR direct TiDB connection, not both)",
    },
    token: {
      label: "API Token",
      sensitive: true,
      placeholder: "clawmem_xxx",
      help: "Authentication token for the Worker API",
    },
    encryptionKey: {
      label: "Encryption Key",
      sensitive: true,
      placeholder: "optional-client-key",
      help: "Optional client-side encryption key for memory content",
      advanced: true,
    },
    host: {
      label: "TiDB Host",
      placeholder: "gateway01.us-east-1.prod.aws.tidbcloud.com",
      help: "TiDB Serverless cluster hostname (direct mode)",
    },
    user: {
      label: "TiDB User",
      placeholder: "your_tidb_user",
      help: "TiDB database username (direct mode)",
    },
    password: {
      label: "TiDB Password",
      sensitive: true,
      placeholder: "your_tidb_password",
      help: "TiDB database password (or use ${TIDB_PASSWORD})",
    },
    database: {
      label: "Database Name",
      placeholder: "memory",
      help: "TiDB database name for storing memories",
    },
    autoCapture: {
      label: "Auto-Capture",
      help: "Automatically capture important information from conversations",
    },
    autoRecall: {
      label: "Auto-Recall",
      help: "Automatically inject relevant memories into context",
    },
    captureMaxChars: {
      label: "Capture Max Chars",
      help: "Maximum message length eligible for auto-capture",
      advanced: true,
      placeholder: String(DEFAULT_CAPTURE_MAX_CHARS),
    },
  },
};
