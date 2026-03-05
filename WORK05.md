# WORK05: 删除 embedding.ts 并更新 SKILL.md

## 目标
删除不再需要的 embedding.ts 文件，更新文档反映新的 Auto Embedding 架构。

## 改动文件
- 删除 `src/embedding.ts`
- `SKILL.md`

## 具体改动

### 1. 删除 `src/embedding.ts`
- 整个文件不再需要

### 2. 更新 SKILL.md
- Prerequisites 中移除 "OpenAI API Key" 要求
- 说明现在使用 TiDB Cloud Auto Embedding（免费、无需 API key）
- Configuration 示例中移除所有 `embedding` 配置块
- 移除 Troubleshooting 中 `embedding.apiKey is required` 条目
- 添加说明：Auto Embedding 仅在 TiDB Cloud Starter (AWS) 上可用
- 更新 Verify Installation 中的日志示例（不再显示 embedding model）

## 验证
- `npx tsc --noEmit` 全项目编译通过
- 确认 `src/embedding.ts` 已删除
- SKILL.md 中无 OpenAI / embedding apiKey 引用
