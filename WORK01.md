# WORK01: 改造 DB schema 使用 TiDB Auto Embedding

## 目标
把 `initSchema()` 中的 memories 表改为使用 TiDB Auto Embedding (`EMBED_TEXT` generated column)，让 embedding 在数据库层自动完成。

## 改动文件
- `src/db.ts`

## 具体改动

### 1. `initSchema()` 签名变更
- 移除 `vectorDims` 参数（不再需要外部指定维度）
- 新增可选参数 `embeddingModel`，默认 `"tidbcloud_free/amazon/titan-embed-text-v2"`（1024 维）

### 2. Schema 改造
把:
```sql
embedding VECTOR(${vectorDims}),
```
改为:
```sql
content_vector VECTOR(1024) GENERATED ALWAYS AS (
  EMBED_TEXT("tidbcloud_free/amazon/titan-embed-text-v2", content)
) STORED,
VECTOR INDEX ((VEC_COSINE_DISTANCE(content_vector)))
```

### 3. 注意事项
- 列名从 `embedding` 改为 `content_vector`（语义更清晰）
- VECTOR INDEX 加上以提升查询性能
- `vectorDims` 不再从外部传入，维度由 model 决定（titan-embed-text-v2 = 1024）
- 保留 `CREATE DATABASE IF NOT EXISTS` 逻辑不变

## 验证
- `npx tsc --noEmit` 编译通过（此步会有下游报错，WORK02 修复）
