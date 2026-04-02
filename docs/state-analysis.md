# src/state 状态管理系统分析

## 一、整体架构概览

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Component Tree                      │
│  (REPL.tsx, PromptInput, Task panels, etc.)                      │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ uses
┌─────────────────────────────────────────────────────────────────┐
│                   AppStateProvider (AppState.tsx)                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  createStore<AppState>(initialState, onChangeAppState)     │ │
│  │  ┌────────────────┐  ┌──────────────────┐                  │ │
│  │  │ state: AppState│  │ listeners: Set   │                  │ │
│  │  └────────────────┘  └──────────────────┘                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           │ exposes via Context                  │
└───────────────────────────┼──────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌─────────────────┐
│ useAppState() │  │ useSetAppState()│  │ useAppStateStore()│
│ (subscribe)   │  │ (stable ref)   │  │ (direct access) │
└───────────────┘  └────────────────┘  └─────────────────┘
        │                   │                   │
        │                   ▼                   ▼
        │          ┌────────────────────────────────────────┐
        │          │         onChangeAppState()              │
        │          │  (state change side effects handler)    │
        │          └────────────────────────────────────────┘
        │                           │
        ▼                           ▼
┌────────────────┐        ┌───────────────────────┐
│   selectors.ts │        │   External Systems    │
│ (derived data) │        │ - CCR metadata sync   │
└────────────────┘        │ - settings persistence│
                          │ - session state       │
                          └───────────────────────┘
```

## 二、核心组件详解

### 1. Store (`store.ts`)

**职责**: 最小化的状态管理原语，提供 Redux 风格的状态容器

**核心 API**:
```typescript
type Store<T> = {
  getState: () => T              // 同步获取当前状态
  setState: (updater: T => T) => void  // 函数式更新
  subscribe: (listener: () => void) => () => void  // 订阅变化
}
```

**实现特点**:
- 使用 `Set` 存储监听器，支持多订阅者
- 使用 `Object.is` 进行浅比较，避免不必要的通知
- `onChange` 回调在状态变化后、通知监听器前执行
- 取消订阅通过返回的清理函数实现

**设计决策**:
- 不依赖外部库（如 Redux/Zustand），保持零依赖
- 函数式更新模式 `(prev) => next` 确保不可变性
- 简单的发布 - 订阅模式，无中间件系统

### 2. AppState (`AppStateStore.ts`)

**职责**: 定义全局状态的完整数据结构

**状态分类**:

| 类别 | 字段示例 | 说明 |
|------|----------|------|
| **设置** | `settings`, `verbose`, `mainLoopModel` | 用户配置和运行时设置 |
| **视图状态** | `expandedView`, `viewSelectionMode`, `footerSelection` | UI 显示状态 |
| **任务管理** | `tasks`, `foregroundedTaskId`, `viewingAgentTaskId` | 所有任务的状态 |
| **MCP/插件** | `mcp`, `plugins`, `agentDefinitions` | 工具和服务注册 |
| **权限** | `toolPermissionContext` | 权限模式和规则 |
| **远程会话** | `remoteSessionUrl`, `replBridge*` | 远程控制和桥接状态 |
| **团队上下文** | `teamContext`, `inbox`, `workerSandboxPermissions` | 多 Agent 协作 |
| **临时状态** | `speculation`, `promptSuggestion`, `skillImprovement` | 高级功能状态 |

**关键设计**:
- 使用 `DeepImmutable` 包装大部分状态，强制不可变更新
- `tasks` 除外（包含函数类型如 `abortController`）
- 通过 `getDefaultAppState()` 提供默认初始值

---

## 二、AppState 完整字段清单

### 1. 用户设置与配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `settings` | `SettingsJson` | 用户设置 (JSON 格式) |
| `verbose` | `boolean` | 详细日志模式开关 |
| `mainLoopModel` | `ModelSetting` | 主循环模型配置 |
| `mainLoopModelForSession` | `ModelSetting` | 会话级别的模型配置 |
| `thinkingEnabled` | `boolean` | 思考模式开关 |
| `fastMode` | `boolean` | 快速模式开关 |
| `effortValue` | `EffortValue` | 努力程度配置 |

### 2. UI 视图状态

| 字段 | 类型 | 说明 |
|------|------|------|
| `expandedView` | `'none' \| 'tasks' \| 'teammates'` | 展开视图类型 |
| `isBriefOnly` | `boolean` | 仅简要模式 |
| `viewSelectionMode` | `'none' \| 'selecting-agent' \| 'viewing-agent'` | 视图选择模式 |
| `footerSelection` | `FooterItem \| null` | Footer 中聚焦的项目 |
| `selectedIPAgentIndex` | `number` | 选中的 IP Agent 索引 |
| `coordinatorTaskIndex` | `number` | 协调器任务面板选中行 |
| `spinnerTip` | `string` | 加载提示文本 |
| `statusLineText` | `string` | 状态行文本 |

### 3. 任务管理

| 字段 | 类型 | 说明 |
|------|------|------|
| `tasks` | `{ [taskId: string]: TaskState }` | 所有任务状态（可变，含函数） |
| `foregroundedTaskId` | `string` | 前台任务 ID（消息显示在主视图） |
| `viewingAgentTaskId` | `string` | 正在查看的 teammate 任务 ID |
| `agentNameRegistry` | `Map<string, AgentId>` | Agent 名称到 ID 的映射 |

### 4. MCP 与插件系统

| 字段 | 类型 | 说明 |
|------|------|------|
| `mcp.clients` | `MCPServerConnection[]` | MCP 服务器连接 |
| `mcp.tools` | `Tool[]` | MCP 工具列表 |
| `mcp.commands` | `Command[]` | MCP 命令列表 |
| `mcp.resources` | `Record<string, ServerResource[]>` | MCP 资源 |
| `plugins.enabled` | `LoadedPlugin[]` | 已启用的插件 |
| `plugins.disabled` | `LoadedPlugin[]` | 已禁用的插件 |
| `plugins.errors` | `PluginError[]` | 插件加载错误 |
| `plugins.installationStatus` | `object` | 后台安装状态 |
| `plugins.needsRefresh` | `boolean` | 是否需要刷新 |
| `agentDefinitions` | `AgentDefinitionsResult` | Agent 定义 |

### 5. 权限与安全

| 字段 | 类型 | 说明 |
|------|------|------|
| `toolPermissionContext` | `ToolPermissionContext` | 工具权限上下文 |
| `denialTracking` | `DenialTrackingState` | 拒绝跟踪状态（分类器模式） |
| `channelPermissionCallbacks` | `ChannelPermissionCallbacks` | 频道权限回调 |

### 6. 远程会话与桥接

| 字段 | 类型 | 说明 |
|------|------|------|
| `remoteSessionUrl` | `string` | 远程会话 URL |
| `remoteConnectionStatus` | 枚举 | 远程连接状态 |
| `remoteBackgroundTaskCount` | `number` | 远程后台任务数 |
| `replBridge*` | 14 个相关字段 | REPL 桥接状态（连接、会话、错误等） |

### 7. 团队协作 (Swarm)

| 字段 | 类型 | 说明 |
|------|------|------|
| `teamContext` | `object` | 团队上下文（名称、成员、tmux 信息） |
| `standaloneAgentContext` | `object` | 独立 Agent 上下文 |
| `inbox.messages` | `Array` | 收件箱消息 |
| `workerSandboxPermissions` | `object` | Worker 沙箱权限请求队列 |

### 8. 通知与提示

| 字段 | 类型 | 说明 |
|------|------|------|
| `notifications` | `object` | 当前通知 + 队列 |
| `elicitation.queue` | `ElicitationRequestEvent[]` | 征询请求队列 |
| `promptSuggestion` | `object` | 提示建议状态 |
| `skillImprovement` | `object` | 技能改进建议 |

### 9. 文件与版本追踪

| 字段 | 类型 | 说明 |
|------|------|------|
| `fileHistory` | `FileHistoryState` | 文件历史快照 |
| `attribution` | `AttributionState` | 代码归属状态 |
| `authVersion` | `number` | 认证版本（登录/登出时递增） |

### 10. 高级功能状态

| 字段 | 类型 | 说明 |
|------|------|------|
| `speculation` | `SpeculationState` | 推测执行状态 |
| `speculationSessionTimeSavedMs` | `number` | 推测执行节省的时间 |
| `todos` | `{ [agentId: string]: TodoList }` | 各 Agent 的 TODO 列表 |
| `sessionHooks` | `SessionHooksState` | 会话钩子 |
| `replContext` | `object` | REPL 工具 VM 上下文 |

### 11. 专用工具状态

| 字段 | 类型 | 说明 |
|------|------|------|
| `tungsten*` | 6 个字段 | tmux 面板状态 |
| `bagel*` | 3 个字段 | WebBrowser 工具状态 |
| `computerUseMcpState` | `object` | Computer Use MCP 状态 |

### 12. 其他运行时状态

| 字段 | 类型 | 说明 |
|------|------|------|
| `agent` | `string` | CLI --agent 标志设置的名称 |
| `kairosEnabled` | `boolean` | Assistant 模式开关 |
| `initialMessage` | `object` | 初始消息（来自 CLI 或计划模式退出） |
| `pendingPlanVerification` | `object` | 待处理的计划验证 |
| `activeOverlays` | `ReadonlySet<string>` | 活动覆盖层（Select 对话框等） |
| `advisorModel` | `string` | 顾问模型配置 |
| `ultraplan*` | 多个字段 | Ultraplan 远程调用状态 |

**总计约 90+ 个状态字段**，涵盖从基础设置到复杂多 Agent 协作的完整应用状态。

### 3. React 集成 (`AppState.tsx`)

**职责**: 将 Store 暴露给 React 组件树

**核心 Hooks**:

```typescript
// 订阅状态切片（使用 useSyncExternalStore）
useAppState(selector: AppState => T): T

// 获取稳定的 setState 引用（不触发重渲染）
useSetAppState(): (updater: AppState => AppState) => void

// 获取完整 store（用于非 React 代码）
useAppStateStore(): Store<AppState>
```

**优化策略**:
- `useAppState` 使用选择器模式，组件只订阅需要的状态切片
- 选择器返回值用 `Object.is` 比较，避免不必要的重渲染
- `useSetAppState` 返回稳定引用，组件不受状态变化影响
- `useAppStateMaybeOutsideOfProvider` 安全版本，provider 外返回 undefined

### 4. 状态变化处理器 (`onChangeAppState.ts`)

**职责**: 处理状态变化的副作用

**监听的状态变化**:

| 状态字段 | 副作用 |
|----------|--------|
| `toolPermissionContext.mode` | 同步到 CCR 外部元数据、SDK 状态流 |
| `mainLoopModel` | 持久化到用户设置 |
| `expandedView` | 持久化到全局配置 |
| `verbose` | 持久化到全局配置 |
| `tungstenPanelVisible` | 持久化到全局配置（仅 ant 用户） |
| `settings` | 清除认证缓存、重应用环境变量 |

**设计亮点**:
- 单一事实来源：所有模式变更都通过此处理
- 智能去重：仅在值真正变化时执行副作用
- 外部化模式：内部模式（如 `auto`/`bubble`）映射到外部模式

### 5. 选择器 (`selectors.ts`)

**职责**: 从原始状态派生计算数据

**核心选择器**:

```typescript
// 获取当前查看的 teammate 任务
getViewedTeammateTask(appState): InProcessTeammateTaskState | undefined

// 确定用户输入的路由目标
getActiveAgentForInput(appState): ActiveAgentForInput
// 返回：{type:'leader'} | {type:'viewed', task} | {type:'named_agent', task}
```

**设计原则**:
- 纯函数，无副作用
- 只提取数据，不修改状态
- 使用 TypeScript 判别联合实现类型安全路由

### 6. 队友视图助手 (`onChangeAppState.ts` / `teammateViewHelpers.ts`)

**职责**: 管理队友任务视图的进入/退出逻辑

**核心函数**:

```typescript
// 进入队友视图：设置 retain=true 阻止驱逐，加载磁盘历史
enterTeammateView(taskId, setAppState)

// 退出队友视图：释放 retain，设置 evictAfter 调度驱逐
exitTeammateView(setAppState)

// 停止/-dismiss: 运行中则终止，否则设置 evictAfter=0 立即隐藏
stopOrDismissAgent(taskId, setAppState)
```

**状态流转**:
```
stub 状态 ──[enter]──> retain 状态（消息追加，磁盘加载）
retain 状态 ──[exit]──> released 状态（evictAfter 定时驱逐）
running 状态 ──[stop]──> aborted
terminal 状态 ──[dismiss]──> evictAfter=0（立即隐藏）
```

## 三、数据流分析

### 状态更新流程

```
用户交互/外部事件
       │
       ▼
┌─────────────────┐
│ setAppState()   │ 函数式更新：(prev) => newState
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Object.is │ 浅比较检查
    └────┬─────┘
         │ 有变化
         ▼
┌─────────────────────┐
│ onChangeAppState()  │ 副作用处理
│ - CCR 元数据同步     │
│ - 设置持久化         │
│ - 缓存清理           │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ listeners.forEach() │ React + 非 React 监听器
└────────────────────┘
```

### 外部系统集成

```
onChangeAppState
       │
       ├──► notifySessionMetadataChanged() ──► CCR external_metadata
       │
       ├──► notifyPermissionModeChanged() ──► SDK status 流
       │
       ├──► updateSettingsForSource() ──► settings.json
       │
       └──► saveGlobalConfig() ──► .claude/global_config.json
```

## 四、关键设计决策

### 1. 自研 Store 而非 Redux/Zustand

**优点**:
- 零外部依赖，减少包体积
- 完全控制实现细节
- 针对特定用例优化（如 `Object.is` 比较）

**权衡**:
- 无 DevTools 支持
- 无中间件生态系统
- 需要自己处理序列化/持久化

### 2. 单一 AppState vs 多 Store

**决策**: 使用单一庞大状态树

**理由**:
- 简化数据流，避免 store 间依赖
- 便于状态持久化和调试
- `tasks` 字典支持任意数量动态任务

**潜在问题**:
- 状态膨胀可能影响性能
- 模块耦合度较高

### 3. DeepImmutable + 函数更新

**模式**:
```typescript
type AppState = DeepImmutable<{...}> & {
  tasks: { [taskId: string]: TaskState } // 豁免，含函数
}
```

**优势**:
- TypeScript 强制不可变访问
- 函数式更新确保历史可追溯
- 便于实现时间旅行调试

### 4. 选择器模式

**设计**:
```typescript
const verbose = useAppState(s => s.verbose)
const model = useAppState(s => s.mainLoopModel)
```

**优化考量**:
- 细粒度订阅，减少重渲染
- 警告：选择器不能返回新对象（`Object.is` 失效）

## 五、依赖关系

### 外部依赖
```typescript
import React from 'react'           // UI 框架
import { useSyncExternalStore }     // React 18+
import { feature } from 'bun:bundle' // 特性开关（DCE）
```

### 内部依赖
```
src/state/
├── store.ts              // 无依赖
├── AppStateStore.ts      // 依赖 types/, tools/, tasks/, utils/
├── AppState.tsx          // 依赖 React, hooks/, context/, utils/permissions/
├── selectors.ts          // 依赖 tasks/
├── onChangeAppState.ts   // 依赖 utils/settings/, utils/sessionState/, bootstrap/
└── teammateViewHelpers.ts // 依赖 tasks/, utils/teammate/
```

## 六、使用模式

### 在 React 组件中使用

```typescript
// 读取状态（订阅）
const verbose = useAppState(s => s.verbose)

// 更新状态（不触发重渲染）
const setAppState = useSetAppState()
setAppState(prev => ({ ...prev, verbose: !prev.verbose }))

// 或直接访问 store
const store = useAppStateStore()
store.getState().tasks
store.setState(prev => ({ ...prev, ... }))
```

### 在非 React 代码中使用

```typescript
// 通过 Context 传递或模块级导入
import { appStore } from './main.js' // 在启动时创建

appStore.getState()
appStore.setState(prev => ...)
appStore.subscribe(() => ...)
```

### 状态持久化

自动持久化的状态：
- `toolPermissionContext.mode` → CCR session metadata
- `mainLoopModel` → user settings.json
- `expandedView` → global config
- `verbose` → global config
- `tungstenPanelVisible` → global config (ant only)

## 七、优势与改进建议

### 优势

1. **简洁性**: ~100 行核心实现，易于理解
2. **类型安全**: 全面 TypeScript 覆盖
3. **性能**: 细粒度订阅 + `Object.is` 优化
4. **可扩展**: 单一状态树易于添加新字段
5. **集成友好**: React hooks + 外部代码均可访问

### 潜在改进

1. **选择器组合**: 可添加 `createSelector` 支持 memoized 派生状态
2. **中间件支持**: 可添加简单的中间件链（如日志、持久化）
3. **DevTools 集成**: 可实现自定义调试面板
4. **状态分片**: 对于 `tasks` 等动态大对象，可考虑独立 store
5. **撤销/重做**: 利用函数式更新历史可实现时间旅行

---

**文件清单**:

| 文件 | 行数 | 职责 |
|------|------|------|
| `store.ts` | 34 | 核心 Store 实现 |
| `AppStateStore.ts` | 569 | 状态类型定义 + 默认值 |
| `AppState.tsx` | 199 | React Provider + Hooks |
| `selectors.ts` | 76 | 派生数据选择器 |
| `onChangeAppState.ts` | 171 | 状态变化副作用处理 |
| `teammateViewHelpers.ts` | 141 | 队友视图状态管理 |

总计约 **1,190 行** 核心状态管理代码。
