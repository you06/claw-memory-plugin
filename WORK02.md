# WORK02: 改造 MemoryStore 使用 TiDB Auto Embedding 查询

## 目标
移除 MemoryStore 中所有应用层 embedding 逻辑，改用 TiDB 的 `VEC_EMBED_COSINE_DISTANCE()` 直接用文本搜索。

## 改动文件
- `src/memory-store.ts`

## 具体改动

### 1. 移除 Embeddings 依赖
- 删除 `import { type Embeddings, vectorToString } from "./embedding.js"`
- 删除 constructor 中的 `embeddings` 参数
- 删除 `this.embeddings` 字段

### 2. `store()` 方法简化
- 移除 `embedding` 参数
- 移除自动生成 embedding 的逻辑
- INSERT 语句中去掉 `embedding` 列（由 TiDB GENERATED COLUMN 自动处理）
```sql
INSERT INTO memories (id, content, source, tags, metadata)
VALUES (?, ?, ?, ?, ?)
```

### 3. `search()` 方法改造
- 不再调用 `this.embeddings.embed(q)` 生成向量
- 直接用 `VEC_EMBED_COSINE_DISTANCE(content_vector, ?)` 做文本语义搜索
```sql
SELECT *, VEC_EMBED_COSINE_DISTANCE(content_vector, ?) AS distance
FROM memories
ORDER BY distance ASC
LIMIT ?
```
- 移除 `searchVector()` 方法（不再需要裸向量搜索）
- 保留 text LIKE fallback（当 TiDB Auto Embedding 不可用时）—— 实际上可以去掉了，因为我们默认启用 auto embedding。但为安全起见保留，用一个 config flag 或 try/catch 降级。

### 4. `update()` 方法简化
- 移除 re-generate embedding 的逻辑（content 变更时 GENERATED COLUMN 自动更新）
- 移除 `UpdateMemoryFields.embedding` 字段

### 5. `bulkStore()` 方法简化
- 移除 `embeddings` 参数
- 移除批量 embedding 生成逻辑
- INSERT 语句去掉 `embedding` 列

## 验证
- `npx tsc --noEmit` 编译通过（此步可能还有 index.ts 报错，WORK03 修复）
