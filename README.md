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

In your `openclaw.json`, assign the memory slot and provide connection details:

```jsonc
{
  "plugins": {
    "slots": {
      "memory": "memory-tidb"
    },
    "entries": {
      "memory-tidb": {
        "config": {
          "tidb": {
            "host": "gateway01.us-east-1.prod.aws.tidbcloud.com",
            "username": "your_user",
            "password": "${TIDB_PASSWORD}",
            "database": "memory"
          },
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

Config values that look like `${VAR_NAME}` are resolved from environment variables at runtime.

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

## CLI

```bash
openclaw tidb-memory list              # show total memory count
openclaw tidb-memory search <query>    # search memories (--limit N)
openclaw tidb-memory stats             # database & embedding stats
```

## Development

```bash
npm install           # install dependencies
npx tsc --noEmit      # type-check without emitting
```

## Acknowledgements

This project is inspired by and builds upon [claw-memory](https://github.com/siddontang/claw-memory) by [@siddontang](https://github.com/siddontang). The original project provides a Cloudflare Worker-based memory service for AI agents using TiDB Zero. This plugin adapts the concept into a native OpenClaw plugin with local self-hosting, optional vector search, and seamless gateway integration.
