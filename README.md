# @openclaw/memory-tidb

OpenClaw plugin that gives your agent **long-term memory** backed by [TiDB](https://tidbcloud.com/) vector search. Memories are embedded via OpenAI and retrieved with cosine similarity so the agent can recall relevant context across conversations.

## Features

- **memory_recall** — search long-term memories by semantic similarity
- **memory_store** — save important information (facts, preferences, decisions) to memory
- **memory_forget** — delete specific memories (GDPR-friendly)
- Auto-recall: injects relevant memories at conversation start
- Auto-capture: extracts memory-worthy content after each conversation
- CLI commands for listing, searching, and inspecting memories

## Installation

```bash
# Clone & install dependencies
cd ~/claw-workspace/claw-memory-plugin
npm install

# Link the plugin into OpenClaw
openclaw plugins install -l ~/claw-workspace/claw-memory-plugin
```

## Configuration

In your `openclaw.json`, assign the memory slot and provide connection details. The plugin supports two modes:

### Direct mode

Connects directly to your TiDB database. You manage the TiDB instance yourself.

```jsonc
{
  "plugins": {
    "slots": {
      "memory": "memory-tidb"
    },
    "entries": {
      "memory-tidb": {
        "config": {
          "host": "gateway01.us-east-1.prod.aws.tidbcloud.com",
          "user": "your_user",
          "password": "${TIDB_PASSWORD}",
          "database": "memory",
          "embedding": {
            "apiKey": "${OPENAI_API_KEY}",
            "model": "text-embedding-3-small"
          },
          "autoRecall": true,
          "autoCapture": true
        }
      }
    }
  }
}
```

### API mode

Connects through a [claw-memory](https://github.com/siddontang/claw-memory) Cloudflare Worker. No local database setup needed — the Worker manages TiDB Zero instances for you.

```jsonc
{
  "plugins": {
    "slots": {
      "memory": "memory-tidb"
    },
    "entries": {
      "memory-tidb": {
        "config": {
          "apiUrl": "https://claw-memory.example.workers.dev",
          "token": "${CLAW_MEMORY_TOKEN}",
          "encryptionKey": "${CLAW_MEMORY_KEY}",  // optional, client-side encryption
          "autoRecall": true,
          "autoCapture": true
        }
      }
    }
  }
}
```

> **Note:** Direct mode and API mode are mutually exclusive. Embedding config is optional in either mode (API mode handles embeddings server-side).

Config values that look like `${VAR_NAME}` are resolved from environment variables at runtime.

### Claiming a TiDB Zero instance

TiDB Zero instances are free but expire after **30 days**. To keep your data permanently, **claim** the instance — this converts it to a free TiDB Cloud Starter cluster with no expiration.

In API mode, use the `memory_claim` tool or CLI:

```bash
openclaw tidb-memory claim
# → Claim URL: https://tidbcloud.com/claim/...
# Open the URL in a browser to complete the claim.
```

### TiDB Zero vs TiDB Cloud

| | TiDB Zero (Serverless) | TiDB Cloud (Dedicated) |
|---|---|---|
| **Cost** | Free tier available, pay-per-use | Fixed monthly pricing |
| **Setup** | Instant, no provisioning | Cluster provisioning required |
| **Scaling** | Automatic | Manual |
| **Best for** | Development, low-traffic agents | Production, high-throughput workloads |

Both use the same `@tidbcloud/serverless` driver; just point `host` at the correct gateway.

## Tools

### memory_recall

Search through stored memories.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Natural-language search query |
| `limit` | number | no | Max results (default: 5) |

### memory_store

Save information to long-term memory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | yes | Information to remember |
| `tags` | string[] | no | Categorization tags |
| `source` | string | no | Source context |
| `importance` | number | no | 0–1 importance score (default: 0.7) |

### memory_forget

Delete a specific memory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | no | Search to find the memory |
| `memoryId` | string | no | Specific memory ID to delete |

At least one of `query` or `memoryId` must be provided.

### memory_claim (API mode only)

Claim your TiDB Zero instance to convert it from a 30-day temporary instance to a permanent free TiDB Cloud Starter cluster. Returns a claim URL to open in a browser.

No parameters.

### memory_info (API mode only)

Get information about your memory space: token status, creation date, expiration, and claim URL.

No parameters.

## CLI

```bash
openclaw tidb-memory list              # show total memory count
openclaw tidb-memory search <query>    # search memories (--limit N)
openclaw tidb-memory stats             # database & embedding stats
openclaw tidb-memory claim             # get claim URL (API mode only)
openclaw tidb-memory info              # show token info (API mode only)
```

## Development

```bash
npm install           # install dependencies
npx tsc --noEmit      # type-check without emitting
```

## Acknowledgements

This project is inspired by and builds upon [claw-memory](https://github.com/siddontang/claw-memory) by [@siddontang](https://github.com/siddontang). The original project provides a Cloudflare Worker-based memory service for AI agents using TiDB Zero. This plugin adapts the concept into a native OpenClaw plugin with local self-hosting, optional vector search, and seamless gateway integration.
