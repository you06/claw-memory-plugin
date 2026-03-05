# WORK04: 清理 config 和 package.json 中的 embedding 配置

## 目标
移除 EmbeddingConfig 类型、config schema 中的 embedding 选项、package.json 中的 openai 依赖。

## 改动文件
- `src/config.ts`
- `openclaw.plugin.json`
- `package.json`

## 具体改动

### 1. `src/config.ts`
- 删除 `EmbeddingConfig` type
- 删除 `BaseMemoryConfig.embedding` 字段
- 删除 `vectorDimsForModel()` 函数及 `EMBEDDING_DIMENSIONS` 常量
- 删除 `memoryConfigSchema.parse()` 中 embedding 相关的解析逻辑
- 删除 `uiHints` 中 `embedding.apiKey` 和 `embedding.model` 条目

### 2. `openclaw.plugin.json`
- 删除 `configSchema.properties.embedding` 整个块
- 删除 `uiHints` 中 `embedding.apiKey` 和 `embedding.model`

### 3. `package.json`
- 移除 `"openai": "^6.25.0"` 依赖

### 4. 运行 `npm install` 更新 lock file

## 验证
- `npx tsc --noEmit` 编译通过
- `npm install` 无报错
