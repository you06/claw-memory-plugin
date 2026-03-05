# WORK03: 清理 index.ts 中的 embedding 相关代码

## 目标
从插件主入口移除所有 OpenAI embedding 配置和逻辑，适配新的 MemoryStore 接口。

## 改动文件
- `src/index.ts`

## 具体改动

### 1. 移除 embedding 相关 import
- 删除 `import { Embeddings, vectorToString } from "./embedding.js"`

### 2. 移除 direct mode 中的 embedding 变量
- 删除 `let embeddings: Embeddings | undefined`
- 删除 `let vectorDim = 1536`
- 删除 `embeddings = cfg.embedding ? new Embeddings(...) : undefined`
- 删除 `vectorDim = cfg.embedding ? vectorDimsForModel(...) : 1536`

### 3. 修改 MemoryStore 构造
- `new MemoryStore(directConn, embeddings)` → `new MemoryStore(directConn)`

### 4. 修改 directAdapter
- 移除 `embeddings` 参数
- `store()` 中移除手动 embedding + dedup 逻辑
- `store()` 直接调用 `store.store(...)` 不传 embedding
- 搜索去重改用 `store.search()` (文本搜索) 替代 `store.searchVector()`

### 5. 修改 service.start()
- `initSchema(directConn, cfg.tidb.database, vectorDim)` → `initSchema(directConn, cfg.tidb.database)`

### 6. 修改 stats CLI 命令
- 移除 `Vector dimensions: ${vectorDim}` 输出
- 改为显示 embedding model 信息（`tidbcloud_free/amazon/titan-embed-text-v2`）

## 验证
- `npx tsc --noEmit` 编译通过
