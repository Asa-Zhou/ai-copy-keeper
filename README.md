# AI 对话格式复制工具

[![Release](https://img.shields.io/github/v/release/Asa-Zhou/ai-copy-keeper?label=release)](https://github.com/Asa-Zhou/ai-copy-keeper/releases/latest)
[![Download](https://img.shields.io/badge/download-exe-blue)](https://github.com/Asa-Zhou/ai-copy-keeper/releases/latest/download/AI-Copy-Keeper.exe)
[![License](https://img.shields.io/github/license/Asa-Zhou/ai-copy-keeper)](LICENSE)

把 AI 网页里复制出来的 Markdown 源码（`###`、`**加粗**`、`| 表格 |`、` ```bash `）
还原成**带格式的富文本**，粘到 Word / 邮件 / 腾讯文档 / 飞书 / 语雀 / OneNote 时
保留标题层级、表格、代码块、加粗、引用。

作者：**AsaZhou**

---

## 两种用法

| 版本 | 位置 | 说明 |
| --- | --- | --- |
| 桌面版（推荐） | `dist/AI对话格式复制工具.exe` | 双击即用，托盘常驻，全局热键 `Ctrl+Alt+M` |
| 网页版 | `src/index.html` | 双击用浏览器打开，功能相同，但没有全局热键和托盘 |

---

## 目录结构

```
.
├─ src/
│  └─ index.html         ★ 页面唯一源文件（网页版就是它；改样式、改解析逻辑都改这里）
├─ electron/             Electron 工程
│  ├─ main.js            主进程：窗口 / 托盘 / 全局热键 / 右键菜单 / 原生剪贴板
│  ├─ preload.js         IPC 桥接，只向页面暴露必要方法
│  ├─ package.json       依赖与 electron-builder 打包配置
│  ├─ resources/
│  │  └─ icon.png        exe 图标（由 tools/make_icon.py 生成）
│  └─ index.html         ⚠️ 生成物，勿手改（由 tools/sync.py 产出）
├─ tools/
│  ├─ sync.py            把 src/index.html 注入 Electron 桥接 → electron/index.html
│  ├─ make_icon.py       生成 256×256 应用图标
│  └─ make_tray_icon.py  生成 64×64 托盘图标（输出 base64，供 main.js 内嵌）
└─ dist/                 交付物（不进 git）
   └─ AI对话格式复制工具.exe
```

### 为什么有两份 index.html

`src/index.html` 是源码，浏览器和桌面版共用同一套界面与解析逻辑。
桌面版需要额外的 IPC 桥接（读剪贴板、存文件、全局热键入口），这些代码由
`tools/sync.py` 用精确替换注入，生成 `electron/index.html`。

**所以：改了 `src/index.html`，必须跑一次 `sync.py`**，否则桌面版还是旧页面。

---

## 进 git / 不进 git

| 进 git（源码） | 不进 git（`.gitignore`） |
| --- | --- |
| `src/index.html` | `electron/index.html`（生成物） |
| `electron/main.js`、`preload.js` | `node_modules/` |
| `electron/package.json`、`package-lock.json` | `dist/`、`*.exe`（96MB，产物） |
| `electron/resources/*.png` | `out*/`、`release*/`（打包输出目录） |
| `tools/*.py` | `.workbuddy/`（本地工具缓存） |
| `.gitignore`、`README.md` | |

---

## 改完代码怎么构建

需要 **Python 3** 和 **Node 18+**。

```bash
# 1. 改完 src/index.html，生成桌面版页面
python tools/sync.py

# 2. 首次使用先装依赖
cd electron
npm install

# 3. 本地调试（热更新不用，改完重启即可）
npm start

# 4. 打包单文件 exe → ../dist/AI对话格式复制工具.exe
npm run dist
```

国内网络建议先设镜像，否则 electron 二进制下载会很慢：

```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm install --registry=https://registry.npmmirror.com
```

---

## 桌面版比网页版多什么

- **全局热键 `Ctrl+Alt+M`**：在任何软件里复制完 AI 回复，按一下，剪贴板直接变成富文本，不需要打开窗口
- **托盘常驻**：关窗口不退出，右键托盘可以退出 / 置顶 / 手动转换
- **右键菜单**：输入框内支持剪切 / 复制 / 粘贴 / 全选
- **原生保存对话框**：存 Word / PNG 时弹系统窗口
- **系统通知**：热键转换完成后提示是否成功

---

## 已知限制

| 现象 | 原因与对策 |
| --- | --- |
| 粘到微信 / QQ 丢格式 | 聊天框只接受纯文本，无解 → 用「存为图片」或「存为 Word」 |
| 粘到 OneNote 代码块变白底黑字 | OneNote 不认块级背景色 → 勾选底部「代码块用浅色」，代码块会输出成浅色表格 |
| exe 首次运行有 SmartScreen 提示 | 未签名，点「更多信息 → 仍要运行」 |
| 体积 96MB | Electron 自带 Chromium，其中业务代码只有约 50KB |
