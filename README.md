# CCNACard — CCNA 200-301 Interactive Practice Cards & Virtual IOS Lab

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Version](https://img.shields.io/badge/Version-v1.2.0-blue.svg)](https://github.com/eviau512/CCNACard/releases/tag/v1.2.0)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0%2B%20%7C%20Web-green.svg)](https://github.com/eviau512/CCNACard)
[![Question Count](https://img.shields.io/badge/Questions-1%2C396%20Complete-orange.svg)](https://github.com/eviau512/CCNACard/releases)
[![Releases](https://img.shields.io/badge/Download-GitHub%20Releases-brightgreen.svg)](https://github.com/eviau512/CCNACard/releases)

**CCNACard** 是面向 Cisco CCNA 200-301 认证考试的智能交互式抽认卡与真实考场仿真练习平台。包含完整的 1,396 道 ExamTopics 真实题库，支持网页单文件离线秒开与原生 Android APK 安装。

---

## ✨ 核心特性 (Key Features)

### 1. 🗂️ 1,396 道全量题库与深度解析
- **全题型支持**：覆盖单选题、多选题、交互式拖拽题 (Drag and Drop)、CLI 配置模拟实验题 (Simulation / Lab)。
- **高清原图还原**：内嵌所有拓扑、报文抓包与考题配图，支持点击轻触全屏放大 (Lightbox)。
- **AI 增强与考点解析**：详细的解题思路、权威 RFC/Cisco 官方参考、易错陷阱与配置命令对照。

### 2. 💻 内嵌虚拟 Cisco IOS 控制台模拟器 (Lab Console)
- **严格还原真实考场**：仅在特定 `Simulation / Lab` 实验题内嵌控制台，坚决杜绝作弊快捷指令（如 `sh run` / `conf t` 按钮），模拟考试真实键盘敲击体验。
- **触屏虚拟硬件功能键**：针对手机键盘缺少控制键的痛点，提供专属硬件触控键：
  - `[Ctrl+C]`：打断命令 / 退出子模式返回特权模式 `#`
  - `[Ctrl+Shift+6]`：中断 Ping / DNS 解析 / 逃逸序列
  - `[Ctrl+A]` / `[Ctrl+E]`：光标一键跳至行首 / 行尾
  - `[Ctrl+Z]`：直接从接口/路由配置模式退回特权模式 `#`
  - `[Ctrl+U]`：清空当前输入行
  - `[Tab]`：标准 Cisco 指令自动补全
  - `[?]`：IOS 上下文帮助
  - `[↑]` / `[↓]`：历史命令追溯翻页
- **Cisco 命令前缀匹配**：原生支持常用缩写命令（如 `ena`、`conf t`、`int e0/1`、`no shut`、`sh ip int br`、`router ospf 1` 等）。
- **多拓扑设备自适应**：自动根据考题拓扑提取对应设备选项卡（如 `SW-1`, `SW-2`, `SW-3`, `SW-4`），具备独立状态与配置会话。

### 3. 🎯 间隔重复记忆算法 (Spaced Repetition)
- **莱特纳抽认卡机制**：掌握题目自动移出主复习流；答错题目自动进入错题重练队列。
- **弱项雷达诊断**：基于 Cisco 考纲 6 大知识领域（网络基础、网络接入、IP 连通性、IP 服务、安全基准、自动化与可编程）智能归类并统计错题弱项。
- **防误触重置保护**：配备呼吸警示徽标与确认弹窗，防止误清除学习进度。

### 4. 🔒 离线优先与数据自主可控
- **零网络依赖**：无需联网、无广告、无数据收集。
- **跨设备记录导入/导出**：学习进度 JSON 一键保存至手机公共【下载 (Download)】文件夹，或通过系统文件选择器随时恢复刷题进度。

---

## 🚀 下载与使用 (Releases & Usage)

所有预编译产物均通过 **[GitHub Releases](https://github.com/eviau512/CCNACard/releases)** 发布：

### 方式 A：Android 手机 / 平板安装（推荐）
前往 [Releases 最新发布页](https://github.com/eviau512/CCNACard/releases/latest) 下载已签名 APK：
- **[CCNA_v1.2.0.apk (最新版本，包含虚拟 IOS 模拟器)](https://github.com/eviau512/CCNACard/releases/latest/download/CCNA_v1.2.0.apk)**
- [CCNA_v1.1.1.apk (历史归档版本)](https://github.com/eviau512/CCNACard/releases/tag/v1.1.1)

或者通过 adb 一键安装到连接的设备：
```bash
adb install -r CCNA_v1.2.0.apk
```

### 方式 B：浏览器即开即用（免安装离线单文件）
从 [Releases 资源列表](https://github.com/eviau512/CCNACard/releases/latest) 下载 `Examtopics_CCNA_200-301_Complete.html`：
- 直接双击或用现代浏览器（Chrome、Edge、Safari、Firefox）打开。
- 单文件聚合，包含全部 1,396 题数据与内嵌资源，断网环境亦可正常刷题。

---

## 🛠️ 自主构建 Android APK (Build from Source)

本项目采用**纯原生无 Gradle**的高性能极速构建脚本，直接调用 Android SDK 底层构建工具（AAPT2 + Javac + D8 + Zipalign + Apksigner），无需漫长的 Gradle 下载与依赖解析，秒级生成签名 APK。

### 构建环境要求：
1. **Python 3.8+**
2. **Android SDK Build-Tools 35+** 与 **android.jar (API 35)**
3. **JDK 17+**

### 执行编译：
```bash
python CCNA-App/build_apk.py
```
构建成功后将在 `Examtopics/output/CCNA.apk` 生成已签名、已对齐的 Release APK。

---

## 📂 仓库目录结构 (Repository Structure)

```text
CCNACard/
├── CCNA-App/                            # Android 原生应用工程
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml      # 清单文件 (支持全屏及文件访问)
│   │   │   ├── java/moe/ccna/cards/
│   │   │   │   └── MainActivity.java    # 原生桥接、文件选择器与下载目录导出
│   │   │   ├── res/                     # 应用图标与主题资源
│   │   │   └── assets/                  # 移动端 WebView 核心引擎
│   │   │       ├── index.html           # 卡片主界面
│   │   │       ├── app.js               # 抽认卡状态机与拖拽逻辑
│   │   │       ├── app.css              # 现代化深色/浅色自适应样式
│   │   │       ├── ios_simulator.js     # 虚拟 Cisco IOS 实验模拟器
│   │   │       ├── ios_simulator.css    # 终端界面与触控键盘样式
│   │   │       └── data/
│   │   │           └── ccna_cards_data.js # 打包内嵌题库数据
│   │   └── build.gradle.kts
│   ├── keystore/debug.keystore          # 签名证书
│   └── build_apk.py                     # 极速轻量编译打包工具
│
├── Examtopics/                          # 题库引擎与数据处理工具链
│   ├── batch/                           # 200 题分卷 HTML 练习册 (Batch 1-7)
│   ├── enrichment/                      # 题目分类映射与考纲知识点标签
│   ├── scripts/                         # 自动化处理脚本 (PDF 提取/清洗/格式化)
│   └── output/                          # 本地编译产物目录 (由 .gitignore 忽略，通过 Releases 发布)
│
├── .gitignore                           # Git 忽略配置
├── LICENSE                              # CC BY-NC-SA 4.0 许可证
└── README.md                            # 项目说明文档
```

---

## 📜 许可证 (License)

本项目采用 **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** 许可协议发布。

您可以自由地：
- **共享**：在任何媒介以任何形式复制、发行本作品。
- **演绎**：修改、转换或以本作品为基础进行创作。

惟须遵守下列条件：
- **署名 (Attribution)**：必须给出适当的署名，提供指向本许可协议的链接，同时标明是否对原作品作出了修改。
- **非商业性使用 (NonCommercial)**：不得将本作品用于商业目的。
- **相同方式共享 (ShareAlike)**：若您修改、转换本作品，或者以本作品为基础进行创作，您必须基于与原先许可协议相同的许可协议分发您贡献的作品。

详见 [LICENSE](LICENSE) 完整条款。
