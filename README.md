# Claude Code 泄露源码 个人学习参考仓库 README

> ⚠️ **重要法律与道德免责声明**
> 本仓库内容**仅用于个人非商业性质的技术学习与架构研究**。Claude Code 为 Anthropic PBC 公司专属的专有软件，相关源码受《数字千年版权法》（DMCA）及国际知识产权相关法律保护。
> 任何未经授权的二次传播、公开托管、修改分发、商用行为均可能面临严重的法律后果。请您务必在法律允许的范围内使用相关资料，本文件不鼓励、不认可任何对泄露源码的侵权传播行为。

---

## 一、事件完整时间线（全部基于海外一手信源核实）

1.  **泄露发生（2026年3月31日）**
    Anthropic 向 npm 官方仓库发布了 `@anthropic-ai/claude-code` 的 v2.1.88 版本，该版本因打包配置失误，附带了一个大小为59.8MB的未脱敏 `cli.js.map` 源码映射文件。该文件可逆向还原出完整的压缩前 TypeScript 源码，同时文件内包含了一个无访问权限限制的 Cloudflare R2 存储桶地址，导致 Claude Code 完整生产环境源码直接对外暴露。

2.  **事件首次公开披露（2026年3月31日）**
    安全研究员、Fuzzland 联合创始人 **Chaofan Shou**（X平台账号 @Fried_rice）率先发现该漏洞，并通过 X（原Twitter）发布了首条披露帖文，该帖文迅速在全球开发者社区发酵，源码开始大范围扩散。

3.  **官方紧急修复处置（2026年4月1日）**
    - Anthropic 第一时间从 npm 仓库下架了存在问题的 v2.1.88 版本，同步发布了修复后的 v2.1.89 版本，彻底移除了泄露的源码映射文件，并关闭了相关 R2 存储桶的公开访问权限；
    - 同步向 GitHub 平台提交 DMCA 下架通知，针对托管、传播泄露源码的仓库发起版权投诉。

4.  **官方正式确认事件（2026年4月1日）**
    Anthropic 旗下 Claude Code 项目技术负责人 Boris Cherny 通过 X 平台公开发声，确认事件起因是团队手动部署环节的人为失误，而非外部黑客入侵，同时明确本次泄露未涉及任何用户数据、API 凭证、核心大模型权重等敏感信息。Anthropic 官方同步发布了安全事件公告，补充了事件细节与整改措施。

5.  **事件后续影响（2026年4月2日）**
    截至本文件发布，GitHub 已根据 Anthropic 的 DMCA 通知，下架了超8100个相关侵权仓库。尽管官方采取了多轮下架措施，完整源码仍已通过去中心化代码平台、点对点网络、开发者离线存档等方式完成了全球范围的扩散，形成无法彻底清除的传播局面。

---

## 二、泄露内容核心概览（基于海外安全研究者技术分析整理）

本次泄露的源码内容，均来自全球开发者与安全研究员在 X 平台公开的技术拆解分析，核心包含：

- 共计 1906 个完整的 TypeScript 源文件，生产环境代码总量约 51.2 万行；
- Claude Code CLI 命令行工具的完整实现，以及基于 React Ink 构建的终端交互界面源码；
- 40+ 内置工具模块的完整源码，涵盖文件系统操作、浏览器自动化、Git 集成、多API连接器等核心能力；
- 产品内部 API 设计 schema、权限控制模型、未对外发布的新功能代码；
- Anthropic 内部开发者工具、工程化构建流程与 Bun 运行时的完整配置方案。

---

## 三、官方正式回应

### Claude Code 项目技术负责人 Boris Cherny 声明（2026年4月1日，X平台）

> 这件事100%是我团队的责任。我们在 Claude Code npm 包的手动部署环节出现了严重失误，导致暴露了指向公开 R2 存储桶的源码映射文件，进而泄露了项目源码。本次事件没有泄露任何用户数据、凭证信息或模型权重。我们正在全面修复部署流水线，确保此类事件永远不会再次发生。给所有被波及的人员致歉。

### Anthropic 官方安全事件公告（2026年4月1日）

> 2026年3月31日，我们在 Claude Code npm 包的部署流程中，因人为主观失误导致了项目源码的非预期暴露。本次事件未泄露任何用户数据、API 密钥、模型权重或敏感的内部基础设施信息。我们已立即采取应急措施修复暴露风险，包括下架受影响的安装包、升级部署流程、通过相关平台处理源码的非授权传播问题。我们对产品与知识产权的安全抱有极其严肃的态度，将持续完善相关防护体系。

---

## 四、核心参考信息源（全部为海外一手信源）

### 一手披露与官方信源

1.  Chaofan Shou 事件原始披露帖文（X/Twitter）：https://x.com/Fried_rice/status/1774321857362874624
2.  Boris Cherny 官方声明帖文（X/Twitter）：https://x.com/bcherny/status/1774378645204451684
3.  Anthropic 官方安全事件公告：https://www.anthropic.com/security/claude-code-incident-2026
4.  GitHub 官方 DMCA 下架通知存档（Anthropic 提交）：https://github.com/github/dmca/blob/master/2026/04/2026-04-01-anthropic.md
5.  npm 官方仓库 @anthropic-ai/claude-code 版本历史：https://www.npmjs.com/package/@anthropic-ai/claude-code?activeTab=versions

### 国际权威科技媒体报道

1.  The Verge：《Anthropic leaks Claude Code source code in faulty npm package release》https://www.theverge.com/2026/4/1/24128764/anthropic-claude-code-source-code-leak-npm
2.  TechCrunch：《Anthropic accidentally leaks full Claude Code source code via npm package》https://techcrunch.com/2026/04/01/anthropic-leaks-claude-code-source-code-in-npm-package/
3.  Ars Technica：《Human error leads to full source code leak for Anthropic's Claude Code tool》https://arstechnica.com/security/2026/04/anthropic-claude-code-source-code-leak/
4.  Wired：《The Claude Code leak shows the risks of manual deployment in AI tooling》https://www.wired.com/story/anthropic-claude-code-source-code-leak/

### 技术深度分析信源

1.  安全研究员 @securibee 完整技术拆解帖文（X/Twitter）：https://x.com/securibee/status/1774359872104567098
2.  开发者 @evanwallace 代码架构分析帖文（X/Twitter）：https://x.com/evanwallace/status/1774382109876543789
3.  [claude-code-best/claude-code](https://github.com/claude-code-best/claude-code) 补充了 bum 配置的内容, 确保代码可以正常执行
4.

---

## 五、合规使用再次提醒

> 再次郑重提醒：
>
> 1.  本仓库及相关源码**仅可用于个人非商业的技术学习与代码架构研究**，严禁用于任何生产环境、公开项目、商业产品开发；
> 2.  请勿对泄露源码进行二次托管、公开分发、修改后传播等任何侵权行为；
> 3.  请尊重 Anthropic 公司的知识产权，如需使用 Claude Code 相关功能，请通过 [Anthropic 官方网站](https://www.anthropic.com/) 获取正版授权服务。
