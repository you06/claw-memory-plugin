---
name: memory-tidb
description: OpenClaw plugin for TiDB-backed long-term memory with vector search. Use this skill to install and configure the memory-tidb plugin, which replaces the default file-based memory with a TiDB Cloud/Zero database and OpenAI embeddings for semantic search.
---

# memory-tidb — OpenClaw Memory Plugin

An OpenClaw plugin that stores agent memories in TiDB with vector search (OpenAI embeddings). Once installed, `memory_recall`, `memory_store`, and `memory_forget` tools automatically connect to TiDB — no manual server startup needed.

## Prerequisites

- **TiDB database** — either:
  - [TiDB Zero](https://zero.tidbcloud.com/) (free, instant, 30-day TTL) — get one with `curl -s -X POST https://zero.tidbapi.com/v1alpha1/instances`
  - [TiDB Cloud Serverless](https://tidbcloud.com/) (persistent, pay-per-use)
- **OpenAI API Key** (optional but recommended) — enables semantic/vector search. Without it, search falls back to text matching.

## Installation

```bash
# 1. Clone the plugin
git clone <repo-url> ~/claw-workspace/claw-memory-plugin
cd ~/claw-workspace/claw-memory-plugin
npm install

# 2. Install into OpenClaw (link mode for development)
openclaw plugins install -l ~/claw-workspace/claw-memory-plugin
```

This will:
- Register the plugin as the `memory` slot provider
- Disable the default `memory-core` plugin
- Prompt you to restart the gateway

## Configuration

Edit your workspace `openclaw.json` (usually `~/.openclaw-<profile>/openclaw.json`):

```jsonc
{
  "plugins": {
    "entries": {
      "memory-tidb": {
        "enabled": true,
        "config": {
          // Required: TiDB connection
          "host": "gateway01.us-west-2.prod.aws.tidbcloud.com",
          "user": "your_tidb_user",
          "password": "your_tidb_password",
          "database": "claw_memory",

          // Optional: enables vector/semantic search
          "embedding": {
            "apiKey": "sk-proj-...",
            "model": "text-embedding-3-small"
          },

          // Optional: auto behaviors
          "autoRecall": true,
          "autoCapture": false
        }
      }
    }
  }
}
```

Use `${ENV_VAR}` syntax for sensitive values (e.g., `"password": "${TIDB_PASSWORD}"`).

After editing config, restart the gateway:

```bash
openclaw gateway restart
```

## Verify Installation

```bash
grep "memory-tidb" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | tail -3
```

You should see:
```
memory-tidb: plugin registered (host: ..., db: ...)
memory-tidb: initialized (host: ..., model: text-embedding-3-small)
```

## Usage

Once installed, these tools are automatically available to all agents:

### memory_recall
Search memories by semantic similarity (or text match if no embedding configured).
```
memory_recall(query="project decisions about auth", limit=5)
```

### memory_store
Save information to long-term memory. Auto-generates embedding on write.
```
memory_store(text="User prefers dark mode", tags=["preference"], source="chat")
```

### memory_forget
Delete a memory by ID or search query.
```
memory_forget(memoryId="abc-123")
memory_forget(query="outdated preference")
```

### CLI Commands
```bash
openclaw tidb-memory list              # total memory count
openclaw tidb-memory search <query>    # search memories
openclaw tidb-memory stats             # database & embedding stats
```

## TiDB Zero Quick Start

If you don't have a TiDB instance yet:

```bash
# Create a free TiDB Zero instance (30-day TTL, no signup needed)
curl -s -X POST https://zero.tidbapi.com/v1alpha1/instances | jq .
```

Returns `host`, `port`, `user`, `password`. Use these in the config above. The database is auto-created on first startup.

To keep data permanently, either **Claim** the TiDB Zero instance or create a [TiDB Cloud Serverless](https://tidbcloud.com/) cluster directly.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `plugin not found: memory-tidb` | Run `openclaw plugins install -l <path>` and restart gateway |
| `embedding.apiKey is required` | Add an OpenAI API key, or remove the `embedding` section for text search only |
| `must have required property 'host'` | Ensure host/user/password/database are all set in config |
| Semantic search returns no results | Old memories may lack embeddings; re-store or backfill manually |

## Acknowledgements

Inspired by [claw-memory](https://github.com/siddontang/claw-memory) by [@siddontang](https://github.com/siddontang).
