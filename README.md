# snow-plugin-store

Snow App 插件市场索引仓库。

Snow App 客户端（插件页 → 插件市场）读取本仓库的 [`app/registry.json`](app/registry.json) 获取插件目录；
插件本体由各作者自己的 GitHub 仓库通过 Release 资产（zip）分发，客户端下载后按索引中锁定的
SHA-256 校验，校验通过再安装。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `app/plugins/<pluginId>.json` | 插件条目源文件（一插件一文件，上架与更新只改这里；文件名必须等于 `<id>.json`） |
| `app/registry.json` | 由 CI 聚合生成的索引（客户端读取；请勿手动编辑，合并后自动重建） |
| `app/entry.schema.json` | 条目 JSON Schema（编辑器提示 / 对照参考） |
| `app/scripts/validate-registry.mjs` | 条目校验脚本（本地与 CI 使用） |
| `app/scripts/build-registry.mjs` | 聚合脚本：从 `app/plugins/` 重新生成 `app/registry.json` |
| `cli/` | 预留：Snow CLI 插件索引（尚未启用，不要在里面放 App 插件） |

## 上架与更新流程

### 1. 准备插件

按 Snow App 插件规范编写插件；打包根目录必须包含合法的 `plugin.json`（字段规范见 Snow App 内置文档
「插件开发与安装」，即应用内 `~/.snowapp/docs`，或 snow-app 仓库的 docs 目录）。

### 2. 发布 Release

1. 将插件目录打包为 zip：`plugin.json` 位于 zip 根目录，不要套一层额外的文件夹；
2. 在插件自己的 GitHub 仓库创建 Release，tag 建议使用语义化版本（如 `v1.2.0`），将 zip 作为 Release 资产上传。

### 3. 取 SHA-256

**首选：直接读 Release 的 API。** 地址按仓库与 tag 拼：

```text
https://api.github.com/repos/<owner>/<repo>/releases/tags/<tag>
```

例如 `https://api.github.com/repos/xqchencn/snow-file-explorer/releases/tags/v1.1.1`。
浏览器打开即可拿到 JSON（未登录有速率限制），用到的字段：

| 字段 | 用途 |
| --- | --- |
| `tag_name` | 条目的 `tag` |
| `assets[].name` | 条目的 `asset`（取 zip 那一条，忽略 `.sha256`、`.txt` 之类附属资产） |
| `assets[].digest` | 条目的 `sha256`，形如 `sha256:<64 位十六进制>`，去掉 `sha256:` 前缀填入 |
| `assets[].size` | 核对拿的是不是同一个文件（与本地 zip 字节数一致） |
| `assets[].browser_download_url` | 核对推导出的下载地址 |

> 坑：Release 若同时上传了 `<zip>.sha256` 这类校验文件，那条资产自己的 `digest` 是**校验文件**的哈希，
> 不是 zip 的哈希。只认 zip 那一条。
> 老 Release 可能没有 `digest` 字段，或你更想自己算，就回退到本地计算：

```bash
# Linux / macOS
sha256sum my-plugin-1.2.0.zip
# Windows PowerShell
Get-FileHash .\my-plugin-1.2.0.zip -Algorithm SHA256
```

### 4. 提交索引

新增或更新 `app/plugins/<pluginId>.json`（一插件一个文件，文件名必须等于 `<id>.json`），然后提交 PR。
`app/registry.json` 由 CI 在合并后自动重建，不需要手动修改。本地可以先跑校验与聚合：

```bash
node app/scripts/validate-registry.mjs   # 校验全部条目
node app/scripts/build-registry.mjs      # 本地重新生成 app/registry.json
```

跑完聚合脚本后把生成的 `app/registry.json` 与条目源文件一起提交也可以（索引不手写，只跑脚本），
这样单看一次提交就能同时核对条目与索引。版本更新提交至少改这四个字段：
`version`、`tag`、`asset`、`sha256`；新增能力时顺带补 `description`（三语）与 `tags` 检索词。

### 5. 合并生效

CI 校验通过并由维护者合并后，客户端在「插件 → 插件市场」刷新即可看到新版本，支持一键安装与更新。

## 索引字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 插件唯一 ID，必须与 `plugin.json` 的 `id` 完全一致；字母、数字、点、短横线、下划线，最长 96 |
| `kind` | 否 | 条目类型：`plugin`（面板插件，默认）或 `script`（用户脚本）；脚本的 Release 资产是 `.user.js` 文件本身 |
| `name` | 是 | 展示名，字符串或本地化对象（如 `{"default": "...", "zh-CN": "..."}`） |
| `description` | 是 | 简介，格式同上 |
| `repo` | 是 | 插件仓库地址，形如 `https://github.com/owner/repo` |
| `version` | 是 | 版本号（与 Release 内容一致） |
| `tag` | 条件 | Release tag，如 `v1.2.0`；未提供 `downloadUrl` 时必填 |
| `asset` | 条件 | Release 资产文件名；未提供 `downloadUrl` 时必填 |
| `downloadUrl` | 否 | 显式指定 zip 直链（https）；提供后不再按 `tag`/`asset` 推导 |
| `sha256` | 是 | zip 的 SHA-256（64 位十六进制） |
| `author` | 否 | 作者署名 |
| `homepage` | 否 | 主页 / 文档地址 |
| `minAppVersion` | 否 | 要求的最低 Snow App 版本；低于该版本的客户端会提示并禁用安装 |
| `privacy` | 否 | 插件声明的敏感数据域列表，与 `plugin.json` 的 `privacy` 一致（安装前会向用户展示） |
| `tags` | 否 | 检索关键词 |
| `icon` | 否 | 市场列表图标，如 `lucide:Puzzle`；缺省显示占位图标 |

下载地址的推导规则：`https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>`。

### 用户脚本（kind: script）

`kind` 为 `script` 时，Release 资产是单个 `.user.js` 文件（不要打包成 zip）：

- 脚本必须包含 `// ==UserScript==` 元数据头（`@name` 必填）；客户端脚本（定制应用窗口）另需 `@snow-target client`；
- 安装后脚本以条目的 `id` 作为脚本标识，更新时原地覆盖同一脚本，不影响其启用状态；
- 浏览器脚本（注入内置浏览器页面）与客户端脚本使用同一条目结构。

## 示例条目

```json
{
  "id": "com.example.note-timer",
  "name": { "default": "Note Timer", "zh-CN": "笔记计时器" },
  "description": {
    "default": "Track time spent on your notes.",
    "zh-CN": "统计笔记上的投入时间。"
  },
  "author": "example",
  "repo": "https://github.com/example/snow-note-timer",
  "version": "1.2.0",
  "tag": "v1.2.0",
  "asset": "snow-note-timer-1.2.0.zip",
  "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "minAppVersion": "0.4.13",
  "privacy": ["memos"],
  "tags": ["productivity", "notes"],
  "icon": "lucide:Timer"
}
```

## 审核说明

- 合并到本仓库只代表索引格式与哈希校验通过，不代表对插件行为的安全背书；
- 插件的运行代码由作者仓库直接提供，安装前客户端会展示 `privacy` 声明的敏感数据域，请使用者自行判断；
- 维护者会拒绝明显恶意、侵权或与描述不符的提交。

## English

This repository is the plugin market index for Snow App. The client (Plugins page → Plugin market)
reads `app/registry.json`; plugin archives are distributed by each author's own GitHub repository
via Release assets (zip) and verified against the SHA-256 pinned in the index before installation.

To publish: add an entry file under `app/plugins/` (one file per plugin, named `<id>.json`); for a
panel plugin, package the folder as a zip with `plugin.json` at the zip root and attach it to a
GitHub Release tag (e.g. `v1.2.0`); for a script, attach the `.user.js` file. Compute the SHA-256
and open a pull request - `app/registry.json` is rebuilt automatically by CI after merge. Run
`node app/scripts/validate-registry.mjs` before submitting. Merging only verifies the index format
and hashes - it is not a security endorsement of the plugin.
