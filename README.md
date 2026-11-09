# CCNACard — CCNA 200-301 Interactive Practice Cards & Virtual IOS Lab

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Version](https://img.shields.io/badge/Version-v1.3.0-blue.svg)](https://github.com/eviau512/CCNACard/releases/tag/v1.3.0)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0%2B%20%7C%20Web-green.svg)](https://github.com/eviau512/CCNACard)
[![Question Count](https://img.shields.io/badge/Questions-1%2C396%20Complete-orange.svg)](https://github.com/eviau512/CCNACard/releases)
[![Releases](https://img.shields.io/badge/Download-GitHub%20Releases-brightgreen.svg)](https://github.com/eviau512/CCNACard/releases)

**CCNACard** 是面向 Cisco CCNA 200-301 认证考试的高性能交互式抽认卡平台与考场级 CLI 模拟器。内嵌完整的 1,396 道 ExamTopics 题库，支持零配置单文件离线网页秒开与原生 Android APK 安装。

---

## ✨ 核心特性 (Key Features)

### 1. 🗂️ 1,396 道全量题库与高保真考点解析
- **全题型支持**：覆盖单选、多选、交互式拖拽题 (Drag and Drop)、CLI 配置模拟实验题 (Simulation / Lab)。
- **100% 拖拽容错引擎**：全面支持无序分组 (Unordered Group)，同一分类或 Cisco IOS 配置块内的命令拖入任意合法槽位均正确判定，拒绝机械倒扣分。
- **高清拓扑与抓包原图**：内嵌所有拓扑、抓包报文及考题配图，支持轻触全屏 Lightbox 缩放查看。
- **深度解析与表格推导**：包含 CIDR 边界数学推导、RFC 规范对照、易错陷阱与官方考试注意项。

### 2. 💻 内嵌考场级虚拟 Cisco IOS 控制台模拟器 (Lab Console)
- **真机键盘敲击还原**：仅在 `Simulation / Lab` 实验题内嵌独立控制台，模拟真实考场无作弊按键环境。
- **触屏专属硬件功能键**：针对移动端虚拟键盘缺失控制键的痛点，提供专属硬件触控键：
  - `[Ctrl+C]`：中断命令 / 退出子模式返回特权模式 `#`
  - `[Ctrl+Shift+6]`：中断 Ping / DNS 解析逃逸序列
  - `[Ctrl+A]` / `[Ctrl+E]`：光标一键跳至行首 / 行尾
  - `[Ctrl+Z]`：直接从接口/路由模式跳回特权模式 `#`
  - `[Ctrl+U]`：清空当前输入行
  - `[Tab]`：标准 Cisco 关键字自动补全
  - `[?]`：IOS 上下文实时语法提示
  - `[↑]` / `[↓]`：历史命令追溯翻页
- **Cisco 命令前缀匹配**：原生支持常用缩写命令（如 `ena`、`conf t`、`int e0/1`、`no shut`、`sh ip int br`、`router ospf 1` 等）。
- **多拓扑设备自适应**：根据考题拓扑动态提供设备选项卡（如 `SW-1`, `SW-2`, `SW-3`, `SW-4`），各设备具备独立的配置会话与接口状态。

### 3. 🧠 有理代数自适应间隔复习引擎 (Rational SRS Engine)
- **平滑非线性就绪函数**：采用有理代数调度曲线 $c_q(\Delta s) = \frac{\Delta s^2}{\Delta s^2 + \tau^2}$（$\tau=25$），消除传统 Leitner 盒子的阶梯式扎堆与复习饥饿，单步计算极速流畅（$< 6.4\,\mu\text{s}$）。
- **防既视感与历史错题轮换**：对近期看过的错题施加 $>500\times$ 的权重抑制，结合历史错题动态随机轮换与步长抖动，杜绝背答案式刷题。
- **错题池自适应调度**：根据错题积压量 $M$ 动态调节全局复习概率 $P_{\text{review}}$，自适应平衡攻坚新题与巩固旧错。

### 4. ☁️ 本地优先与 Google Drive 零客户端云同步 (Local-First & Cloud Sync)
- **纯粹本地优先 (Local-First)**：默认完全离线运行，无广告、无隐私追踪、无需注册第三方私有账号，所有数据安全保存在本地。
- **直接 Google Drive REST API v3 漫游同步**：
  - **免安装客户端**：类似 FBReader 的轻量原生方案，直接与 Google Drive API 对接，通过 OAuth2 本地回环（Loopback）鉴权，设备无需预装庞大的 Google Drive 桌面/移动客户端。
  - **跨设备无缝漫游**：在多台手机、平板或 PC 浏览器之间自由迁移刷题进度。
  - **智能冲突合并**：云端同步采用保守合并策略，时间戳平局时优先保留错题未掌握状态，杜绝刷题进度丢失。
- **冷备份导出/导入**：随时将学习进度以标准 JSON 格式导出至本地文件系统，方便永久归档与迁移。

---

## 🚀 下载与使用 (Releases & Usage)

所有最新预编译工件均已发布在 **[GitHub Releases (v1.3.0)](https://github.com/eviau512/CCNACard/releases/tag/v1.3.0)**：

### 方式 A：Android 手机 / 平板安装（推荐）
前往 [Releases 发布页](https://github.com/eviau512/CCNACard/releases/tag/v1.3.0) 下载最新构建的已签名 APK：
- **[CCNA.apk (最新 v1.3.0 Release)](https://github.com/eviau512/CCNACard/releases/download/v1.3.0/CCNA.apk)**

或通过 adb 命令直接推送到已连接的设备：
```bash
adb install -r --user 0 CCNA.apk
```

### 方式 B：桌面/平板浏览器即开即用（免安装离线单文件）
从 [Releases 发布页](https://github.com/eviau512/CCNACard/releases/tag/v1.3.0) 下载单文件网页版：
- **[CCNA_Interactive_App.html](https://github.com/eviau512/CCNACard/releases/download/v1.3.0/CCNA_Interactive_App.html)**
- 直接双击或使用任意现代浏览器（Chrome、Edge、Safari、Firefox）打开即可使用。
- 单文件内聚全部 1,396 道题库数据与内嵌资源，完全断网环境亦可离线刷题。

---

## 🛠️ 本地编译构建 (Build from Source)

本项目采用**纯原生无 Gradle**的高性能极速构建脚本，直接调用 Android SDK 命令行工具链（AAPT2 + Javac + D8 + Zipalign + Apksigner），秒级生成 Release 签名 APK：

```bash
# 1. 编译 Android APK
python CCNA-App/build_apk.py

# 2. 重新打包单文件网页版
python Examtopics/scripts/build_browser_app.py

# 3. 运行自动化断言测试套件 (包含 154 题拖拽排列断言与 Chrome/Firefox 双浏览器测试)
python Examtopics/scratch/test_all_154_dnd_permutations.py
python Examtopics/scratch/test_v130_adaptive_and_sync.py
```

---

## 📂 仓库目录结构 (Repository Structure)

```text
CCNACard/
├── AGENTS.md                            # 题库审查标准与防复发工程规约
├── CCNA-App/                            # Android 原生应用工程
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml      # 清单文件 (支持全屏及文件访问)
│   │   │   ├── java/moe/ccna/cards/
│   │   │   │   └── MainActivity.java    # 原生桥接、文件选择器与下载目录导出
│   │   │   ├── res/                     # 应用图标与主题资源
│   │   │   └── assets/                  # 移动端 WebView 核心引擎
│   │   │       ├── index.html           # 卡片主界面
│   │   │       ├── app.js               # 抽认卡状态机、拖拽与 Google Drive 同步
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
│   ├── batch/                           # 200 题分卷 JSON/HTML 练习册 (Batch 1-7)
│   ├── output/                          # 编译产物目录 (通过 Releases 发布)
│   └── scripts/                         # 构建与数据同步脚本
│
├── .gitignore                           # Git 忽略配置
├── LICENSE                              # CC BY-NC-SA 4.0 许可证
└── README.md                            # 项目说明文档
```

---

## 📜 许可证 (License)

本项目采用 **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** 许可协议发布。详见 [LICENSE](LICENSE) 完整条款。
