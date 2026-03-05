---
name: memory-tidb
description: OpenClaw plugin for TiDB-backed long-term memory with vector search. Uses TiDB Cloud Auto Embedding (built-in, free, no API key needed) for semantic search.
---

# memory-tidb — OpenClaw Memory Plugin

An OpenClaw plugin that stores agent memories in TiDB with vector search powered by **TiDB Auto Embedding** — no OpenAI API key required. Once installed, `memory_recall`, `memory_store`, and `memory_forget` tools automatically connect to TiDB — no manual server startup needed.

Supports two connection modes:
- **Direct mode** — connects to TiDB Serverless directly (you manage the database)
- **API mode** — connects through a claw-memory Cloudflare Worker (no local DB setup). Adds `memory_claim` and `memory_info` tools for managing your TiDB Zero instance, including claiming it as a permanent free Starter cluster.

## Prerequisites

- **TiDB database** — either:
  - [TiDB Zero](https://zero.tidbcloud.com/) (free, instant, 30-day TTL) — get one with `curl -s -X POST https://zero.tidbapi.com/v1alpha1/instances`
  - [TiDB Cloud Serverless](https://tidbcloud.com/) (persistent, pay-per-use)
- **No additional API keys needed** — embedding is handled by TiDB Cloud's built-in Auto Embedding feature (`tidbcloud_free/amazon/titan-embed-text-v2`)

> **Note:** TiDB Auto Embedding is available on TiDB Cloud Starter (AWS). TiDB Zero instances automatically support it after claiming.

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

Edit your workspace `openclaw.json` (usually `~/.openclaw-<profile>/openclaw.json`).

### Direct mode (connect to TiDB yourself)

```jsonc
{
  "plugins": {
    "entries": {
      "memory-tidb": {
        "enabled": true,
        "config": {
          "host": "gateway01.us-west-2.prod.aws.tidbcloud.com",
          "user": "your_tidb_user",
          "password": "your_tidb_password",
          "database": "claw_memory",
          "autoRecall": true,
          "autoCapture": false
        }
      }
    }
  }
}
```

### API mode (via claw-memory Worker)

```jsonc
{
  "plugins": {
    "entries": {
      "memory-tidb": {
        "enabled": true,
        "config": {
          "apiUrl": "https://claw-memory.example.workers.dev",
          "token": "${CLAW_MEMORY_TOKEN}",
          "encryptionKey": "${CLAW_MEMORY_KEY}",  // optional
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
memory-tidb: plugin registered (direct mode, host: ..., db: ...)
memory-tidb: initialized (direct, host: ..., model: tidbcloud_free/amazon/titan-embed-text-v2)
```

## Post-Installation: Notify the User

After installing this plugin, **you (the agent) should immediately inform the user** about the following:

1. **TiDB Zero instances expire in 30 days.** If the user is using TiDB Zero (the free instant database), their data will be deleted after 30 days unless they **claim** the instance.
2. **To keep data permanently**, the user needs to:
   - Run `memory_claim()` (or `openclaw tidb-memory claim`) to get a claim URL
   - Open the URL in a browser — this will guide them to create a free TiDB Cloud account and convert the Zero instance into a permanent free Starter cluster
3. **No credit card is required** — TiDB Cloud Starter is free.

If you detect (via `memory_info()`) that the token is within 7 days of expiration, **urgently remind the user** to claim their instance before data is lost.

### First Session Checklist

On your first interaction with the user after this plugin is installed:
- Call `memory_info()` to check the current backend status (works in both API and direct mode)
- If the instance is a TiDB Zero (30-day TTL), proactively tell the user they should claim or migrate for permanent storage
- In API mode: provide the claim URL directly via `memory_claim()`
- In direct mode: guide the user to create a free TiDB Cloud Starter cluster at https://tidbcloud.com/

## Usage

Once installed, these tools are automatically available to all agents:

### memory_recall
Search memories by semantic similarity using TiDB Auto Embedding.
```
memory_recall(query="project decisions about auth", limit=5)
```

### memory_store
Save information to long-term memory. Embedding is generated automatically by TiDB on write.
```
memory_store(text="User prefers dark mode", tags=["preference"], source="chat")
```

### memory_forget
Delete a memory by ID or search query.
```
memory_forget(memoryId="abc-123")
memory_forget(query="outdated preference")
```

### memory_claim
Claim your TiDB Zero instance to make it permanent.
- **API mode:** Returns a claim URL to open in a browser (converts Zero to free Starter).
- **Direct mode:** Detects if you're connected to TiDB Zero and provides migration guidance.
- **Persistent connection:** Reports no action needed.
```
memory_claim()
```

### memory_info
Get information about the memory backend: connection mode, status, expiration, claim URL.
```
memory_info()
# Works in both API and direct mode
```

### CLI Commands
```bash
openclaw tidb-memory list              # total memory count
openclaw tidb-memory search <query>    # search memories
openclaw tidb-memory stats             # database & embedding stats
openclaw tidb-memory claim             # get claim URL / migration guidance
openclaw tidb-memory info              # show backend status and expiration
```

## TiDB Zero Quick Start

If you don't have a TiDB instance yet:

```bash
# Create a free TiDB Zero instance (30-day TTL, no signup needed)
curl -s -X POST https://zero.tidbapi.com/v1alpha1/instances | jq .
```

Returns `host`, `port`, `user`, `password`. Use these in the config above. The database is auto-created on first startup.

To keep data permanently, **claim** the instance (`openclaw tidb-memory claim` or use the `memory_claim` tool) to convert it to a free TiDB Cloud Starter cluster, or create a [TiDB Cloud Serverless](https://tidbcloud.com/) cluster directly.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `plugin not found: memory-tidb` | Run `openclaw plugins install -l <path>` and restart gateway |
| `must have required property 'host'` | Ensure host/user/password/database are all set in config |
| Semantic search returns poor results | TiDB Auto Embedding requires TiDB Cloud Starter (AWS). Ensure your cluster supports it. Falls back to text LIKE search otherwise. |

## Acknowledgements

Inspired by [claw-memory](https://github.com/siddontang/claw-memory) by [@siddontang](https://github.com/siddontang).
