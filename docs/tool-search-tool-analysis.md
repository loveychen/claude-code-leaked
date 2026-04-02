# ToolSearch 工具分析

本文分析 `ToolSearch`（`src/tools/ToolSearchTool`）的设计与行为，重点覆盖：

- prompt 内容与语义
- 输入/输出 schema
- 执行逻辑与检索规则
- 结果映射格式
- 启用条件与限制

## 1. 工具定位

`ToolSearch` 的作用是：在 deferred（延迟加载）工具场景下，按名称或关键词检索工具，并把匹配工具以 `tool_reference` 形式返回，让模型拿到完整 schema 后再调用目标工具。

关键定义：

- 名称常量：`src/tools/ToolSearchTool/constants.ts`
  - `TOOL_SEARCH_TOOL_NAME = 'ToolSearch'`
- 主实现：`src/tools/ToolSearchTool/ToolSearchTool.ts`
- prompt 与 deferred 判定：`src/tools/ToolSearchTool/prompt.ts`

## 2. Prompt 分析

### 2.1 Prompt 头尾结构

`getPrompt()` 由三部分拼接：

1. `PROMPT_HEAD`
2. `getToolLocationHint()`
3. `PROMPT_TAIL`

语义核心：

- 该工具用于“拉取 deferred tools 的完整 schema”。
- 在拉取前，模型只知道工具名，不知道参数 schema，不能正确调用。
- 返回格式是 `<functions>` 块，内部每个工具一条 `<function>{...}</function>`，与主工具列表编码一致。
- 支持三类查询示例：
  - `select:Read,Edit,Grep`（精确选取）
  - `notebook jupyter`（关键词检索）
  - `+slack send`（`+` 前缀为强制词）

### 2.2 Deferred tools 出现位置提示

`getToolLocationHint()` 会根据 `isDeferredToolsDeltaEnabled` 同步逻辑给出提示：

- 新模式：在 `<system-reminder>` 中按名称出现
- 旧模式：在 `<available-deferred-tools>` 中按名称出现

这段提示帮助模型知道“待检索工具名”从哪里读到。

### 2.3 哪些工具会被 deferred

`isDeferredTool(tool)` 规则（按优先级）：

1. `alwaysLoad === true`：永不 deferred
2. `isMcp === true`：总是 deferred
3. `ToolSearch` 自身：永不 deferred
4. 某些特性工具强制首轮可见（如 Agent/Brief/SendUserFile 的特定条件）
5. 其余按 `tool.shouldDefer === true` 判定

含义：ToolSearch 主要解决 MCP/shouldDefer 工具不提前下发 schema 的问题。

## 3. 输入 Schema

来源：`src/tools/ToolSearchTool/ToolSearchTool.ts` 的 `inputSchema`。

字段：

- `query: string`（必填）
  - 描述：查询 deferred tools。支持 `select:<tool_name>` 或关键词。
- `max_results?: number`（可选，默认 `5`）
  - 描述：最多返回条数。

实现细节：

- 该 schema 未显式设置最小/最大值限制（仅 `number` + default）。
- 业务逻辑中仅在关键词路径使用 `max_results`；`select:` 直接按请求名称返回 found 列表。

## 4. 输出 Schema

来源：`outputSchema`。

字段：

- `matches: string[]`
- `query: string`
- `total_deferred_tools: number`
- `pending_mcp_servers?: string[]`

含义：

- `matches` 是匹配到的工具名集合。
- `total_deferred_tools` 是当前 deferred 池大小（用于上下文判断）。
- 无匹配时，如果有 MCP server 仍在连接，会附带 `pending_mcp_servers`。

## 5. 调用逻辑

主流程（`call`）：

1. 从 `tools` 过滤 deferred 工具池
2. 必要时失效描述缓存（deferred 集合变化会清 cache）
3. 识别查询类型：
   - `select:` 精确选择
   - 否则关键词检索
4. 返回标准输出结构

### 5.1 select: 语义

`query` 匹配 `^select:(.+)$` 时：

- 支持逗号分隔多选：`select:A,B,C`
- 每个名称先在 deferred 中找，找不到再在全量 `tools` 中找
  - 这是刻意的“no-op 兼容”：已加载工具也可返回，减少模型重试抖动
- 若一个都没找到：返回空 `matches`，并在有 pending MCP 时附带 `pending_mcp_servers`
- 部分命中允许返回 found 子集

### 5.2 关键词检索语义

关键词路径由 `searchToolsWithKeywords` 实现，核心点：

1. 快速路径：
   - 查询文本若与某工具名完全相等（忽略大小写），直接返回该工具
2. MCP 前缀路径：
   - 查询以 `mcp__` 开头时，按前缀匹配 deferred 名称
3. 词项拆分：
   - `+term` 为 required term
   - 其他为 optional/scoring term
4. required 预过滤：
   - required term 必须在“名称分词/描述/searchHint”中全部满足
5. 评分排序（降序）：
   - 名称精确 part 命中权重高（MCP 更高）
   - part 包含命中次之
   - searchHint 命中加分
   - 描述词边界命中再加分
6. 仅保留 `score > 0` 的项，最后截断到 `max_results`

名称解析细节：

- MCP 名称（如 `mcp__server__action`）按 `__`/`_` 拆分。
- 普通工具名按 CamelCase 与 `_` 拆分。

## 6. 结果映射（真正发给模型的格式）

`mapToolResultToToolResultBlockParam` 的行为非常关键：

- 若 `matches` 为空：
  - 返回文本型 `tool_result`
  - 文案为 `No matching deferred tools found`
  - 若有 pending MCP server，会追加“仍在连接，稍后重试”的提示
- 若 `matches` 非空：
  - 返回 `tool_result`，其 `content` 为 `tool_reference[]`
  - 每项形如：`{ type: 'tool_reference', tool_name: '...' }`

这意味着 ToolSearch 的核心产物不是“纯文本说明”，而是可被后续流程识别与展开的 `tool_reference` 块。

## 7. 启用条件与限制

ToolSearch 是否可用，不只取决于工具代码本身，还受全局门控影响（`src/utils/toolSearch.ts`）。

### 7.1 模式控制（ENABLE_TOOL_SEARCH）

`getToolSearchMode()`：

- `tst`：启用 ToolSearch（默认就是此模式）
- `tst-auto`：自动阈值模式（`auto`/`auto:N`）
- `standard`：禁用 ToolSearch

规则摘录：

- `ENABLE_TOOL_SEARCH=true` -> `tst`
- `ENABLE_TOOL_SEARCH=auto` 或 `auto:1-99` -> `tst-auto`
- `ENABLE_TOOL_SEARCH=false` 或 `auto:100` -> `standard`
- 未设置 -> `tst`（默认 deferred）
- `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=true` 会强制 `standard`

### 7.2 模型能力限制

ToolSearch 依赖 `tool_reference`。

- `modelSupportsToolReference(model)` 不支持时直接禁用
- 默认把 `haiku` 视为不支持（可由 GrowthBook 配置覆盖）

### 7.3 可用性限制

即使模式允许，也要求 ToolSearch 工具本身在工具列表中可见：

- `isToolSearchToolAvailable(tools)` 为 false（例如被 disallow）时禁用

### 7.4 auto 阈值限制

在 `tst-auto` 下，只有 deferred 工具体量超过阈值才启用：

- 优先用 token 统计
- token 不可用时回退字符数估算
- 默认阈值比例为上下文窗口的 10%（可被 `auto:N` 调整）

## 8. 与错误恢复的配合

在工具执行层（`src/services/tools/toolExecution.ts`）有一个关键恢复提示：

- 当 deferred 工具的 schema 未出现在已发现集合里，容易出现参数类型被模型误生成为字符串，触发 zod 校验失败。
- 系统会附加提示：先调用 `ToolSearch`，查询 `select:<toolName>` 再重试。

这说明 ToolSearch 是 deferred 工具调用链中“避免 schema 缺失导致参数类型错误”的核心恢复手段。

## 9. 总结

ToolSearch 本质是 deferred tools 的“schema 发现与解锁”工具，而不是普通文本搜索工具。其关键设计点包括：

- prompt 明确声明“先发现 schema 再调用”
- 输入支持精确选择与关键词检索，并带 required term 语义
- 输出结构化地返回 `tool_reference`，驱动后续工具可调用
- 启用受模式、模型支持、工具可见性与体量阈值共同约束
- 在 schema 缺失报错链路中承担标准恢复入口
