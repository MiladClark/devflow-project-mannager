<div align="center">

<img src="build/icon.png" alt="DevFlow Manager" width="120" />

# DevFlow Manager

### Your local dev projects — created, launched, monitored, and shipped from one place.

A fast Windows desktop app that turns the daily chaos of juggling local dev projects
into a single, calm control center: discover and run projects, watch their health in
real time, drop into an integrated terminal, spin up databases, and build & ship —
all without leaving the window.

[![Latest Release](https://img.shields.io/github/v/release/MiladClark/devflow-project-mannager?label=download&style=for-the-badge)](https://github.com/MiladClark/devflow-project-mannager/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6?style=for-the-badge&logo=windows)](https://github.com/MiladClark/devflow-project-mannager/releases/latest)
[![Website](https://img.shields.io/badge/website-devtune.app-6366F1?style=for-the-badge)](https://devtune.app)

<br />

![Built with Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)

<br />

**🌐 English** · [فارسی 🇮🇷](#-فارسی--persian)

</div>

<a id="english"></a>

---

## ✨ What it does

DevFlow Manager sits between you and your local development environment. Instead of a
dozen terminal tabs, half-remembered `cd` paths, and "which port was that on again?",
you get one polished cockpit for everything.

> **Note** — DevFlow is currently **Windows-only** (Windows 10 / 11).

<br />

<div align="center">

_Add your screenshots here_

<!-- ![Dashboard](docs/screenshot-dashboard.png) -->
<!-- ![Project detail](docs/screenshot-project.png) -->

</div>

---

## 🚀 Features

### 🗂️ Project management
- **Auto-discovery** — scan any folder and DevFlow finds every project inside it.
- **Framework detection** — automatically identifies Next.js, Payload, Strapi, Vite,
  React (CRA), Vue, Electron, Node, and Tailwind projects.
- **Smart defaults** — detects package manager, Node version, run/build scripts, and
  default port for each project.
- One-click **import** and organize your whole workspace.

### ▶️ Run & monitor
- Start / stop dev servers with a click and stream their output live.
- **Real-time CPU & memory** graphs per running project.
- **Port management** — see who owns a port and take it over when it's stuck.
- **Auto-start** selected projects on launch _(Pro)_.

### 💻 Integrated terminal
- A real terminal powered by **node-pty + xterm** — not a fake log box.
- Multiple terminal sessions with tabs, right inside each project.

### 📦 Build & Setup
- **Build wizard** — detect build eligibility, configure targets, and produce packaged
  artifacts with checksums and manifests _(Pro)_.
- **Scaffold new projects** with opt-in add-ons: Prettier, ESLint, React Router, Lucide,
  Zustand, TanStack Query, Vitest, and a Decap CMS admin.

### 🩺 Health & system
- **System Health** — scan projects for issues and get per-project health summaries.
- **App & Tools** — detect, install, and uninstall common dev tools, and manage Windows
  services.
- **Git panel** — common git operations per project without leaving the app.

### 🗄️ Data & infrastructure
- **Docker integration** — view status, list/act on containers, and create containers.
- **Databases** — list and create databases; manage `docker compose` stacks
  (up / down / ps / logs).
- **Connections** — save, test, and apply reusable service connections.

### 🎛️ Quality-of-life
- **Command palette** (`Ctrl+K`) and a full keyboard-shortcut map (`Ctrl+/`).
- **Env editor** for `.env` files, a unified **Logs** viewer, and one-click
  **open in VS Code / Cursor** (or your own editor command).
- System **tray**, desktop **notifications**, close-to-tray, launch-at-login, and
  start-minimized.
- A crisp, frameless dark UI.

### 🔄 Effortless updates
- **Installer-based auto-update** — Setup installations use the supported
  `electron-updater` + NSIS flow. DevFlow downloads the release installer in the
  background, verifies the SHA-512 metadata generated with that installer, installs
  it in place, and relaunches automatically.

---

## 📥 Download & install

Grab the latest build from the [**Releases page**](https://github.com/MiladClark/devflow-project-mannager/releases/latest):

| Download | Best for |
| --- | --- |
| **Setup installer** (`…-setup.exe`) | Normal install — creates Start-menu & desktop shortcuts. |
| **Portable** (`…-portable.zip`) | No install — unzip and run `DevFlow Manager.exe`; replace the folder manually when updating. |

Both contain the same app and features. The **Setup installation is recommended** and
supports automatic in-place updates. The portable ZIP intentionally remains a manual,
folder-based distribution so an updater never mutates an arbitrary removable folder.

> ℹ️ Builds are currently **unsigned**, so Windows SmartScreen may warn on first launch.
> Choose **More info → Run anyway**.

---

## 🔐 Plans

DevFlow requires a **free DevTune account** to use. Sign in unlocks the free tier; a Pro
license lifts the limits and enables premium features.

| | **Guest** (signed out) | **Free** | **Pro** |
| --- | :---: | :---: | :---: |
| Browse the UI | ✅ | ✅ | ✅ |
| Use any feature | ❌ | ✅ | ✅ |
| Projects | — | 3 | Unlimited |
| Devices | — | 1 | Unlimited |
| Terminal sessions | — | 1 | Unlimited |
| Build & Setup, Health Audit | — | ❌ | ✅ |
| Cloud backup, Export/Import | — | ❌ | ✅ |
| Auto-start, Custom themes, Premium templates | — | ❌ | ✅ |
| Team mode, Shared templates, API, Webhooks | — | ❌ | ✅ |

Manage your plan at **[devtune.app](https://devtune.app)**.

---

## 🛠️ Tech stack

| Layer | Tech |
| --- | --- |
| Shell | **Electron 43** (custom frameless window, tray, notifications) |
| UI | **React 19**, **React Router 7**, **Tailwind CSS 4**, **Zustand 5**, **Recharts 3**, **Lucide** |
| Terminal | **node-pty** + **@xterm/xterm** |
| Build | **Vite 8** (Rolldown), **TypeScript 7**, **electron-builder 26** |
| Updates | `electron-updater` + per-user NSIS via GitHub Releases; policy from DevTune API |

---

## 👩‍💻 Development

**Requirements:** Node.js 22+ and npm.

```bash
# install dependencies
npm install

# run in dev (Vite + Electron with hot reload)
npm run dev

# type-check
npm run typecheck

# production build (renderer + main + preload)
npm run build
```

### Handy scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Launch the app with hot reload. |
| `npm run build` | Type-check and build the renderer, main, and preload. |
| `npm run package` | Produce the portable app in `devflow/`. |
| `npm run package:zip` | Zip the portable build for distribution. |
| `npm run build-icon` | Regenerate app icons from source art. |

---

## 🏗️ Architecture

```
electron/            # main process (Node side)
├── main.ts          # app lifecycle, window, tray, startup
├── preload.ts       # secure IPC bridge (contextIsolation)
├── ipc/             # feature handlers: projects, runner, terminal,
│                    #   docker, compose, git, health, build, updates, …
└── lib/             # core logic: framework detection, licensing,
                     #   updater, stats, ports, store, tray, …

src/                 # renderer (React)
├── pages/           # Dashboard, Projects, Build & Setup, Logs,
│                    #   System Health, Database, Connections, …
├── components/      # UI building blocks
├── state/           # Zustand store
└── lib/             # renderer helpers (ipc, theme, nav, guest, …)
```

Renderer routes are **code-split** so the app paints fast — heavy chunks (charts,
terminal) load only when their screen is opened.

---

## 📦 Releasing

Releases are fully automated. Push a version tag and GitHub Actions builds, publishes,
and registers the update:

```bash
# 1. bump "version" in package.json (e.g. 0.1.21 → 0.1.22)
# 2. tag it to match and push
git tag v0.1.22
git push origin v0.1.22
```

CI builds the portable ZIP and the NSIS Setup together with `latest.yml` and its
differential blockmap, validates that bundle, publishes it as one GitHub Release, and
then registers release policy with the DevTune API. Setup installations receive the
update automatically on their next launch.

<br />

<div align="center">

Made with ⚡ by **[DevTune](https://devtune.app)**

</div>

<br />

---
---

<br />

<div dir="rtl" align="right">

<a id="-فارسی--persian"></a>

# 🇮🇷 فارسی — Persian

<div align="center">

## DevFlow Manager

### همه‌ی پروژه‌های توسعه‌ی محلی‌ات — ساخت، اجرا، مانیتور و انتشار، همه از یک‌جا.

</div>

یک اپ دسکتاپِ سریع برای ویندوز که هرج‌ومرجِ روزانه‌ی کار با چند پروژه‌ی توسعه‌ی محلی را
تبدیل می‌کند به یک کابینِ کنترلِ واحد و آرام: پروژه‌ها را پیدا و اجرا کن، سلامتشان را
لحظه‌ای ببین، واردِ ترمینالِ یکپارچه شو، دیتابیس بالا بیاور، و بیلد و منتشر کن — همه بدون
خارج شدن از پنجره.

> **توجه** — DevFlow فعلاً فقط برای **ویندوز** است (ویندوز ۱۰ / ۱۱).

---

## 🚀 امکانات

### 🗂️ مدیریت پروژه
- **کشف خودکار** — هر پوشه‌ای را اسکن کن و DevFlow همه‌ی پروژه‌های داخلش را پیدا می‌کند.
- **تشخیص فریم‌ورک** — به‌طور خودکار پروژه‌های Next.js، Payload، Strapi، Vite،
  React (CRA)، Vue، Electron، Node و Tailwind را می‌شناسد.
- **پیش‌فرض‌های هوشمند** — پکیج‌منیجر، نسخه‌ی Node، اسکریپت‌های run/build و پورتِ پیش‌فرضِ
  هر پروژه را تشخیص می‌دهد.
- **ایمپورتِ** یک‌کلیکی و مرتب‌سازیِ کلِ فضای کاری.

### ▶️ اجرا و مانیتور
- سرورهای dev را با یک کلیک استارت/استاپ کن و خروجی‌شان را زنده ببین.
- نمودارِ **CPU و RAM لحظه‌ای** برای هر پروژه‌ی در حال اجرا.
- **مدیریت پورت** — ببین چه چیزی پورت را گرفته و وقتی گیر کرد، پورت را پس بگیر.
- **اجرای خودکار** پروژه‌های انتخابی هنگام باز شدن اپ _(Pro)_.

### 💻 ترمینال یکپارچه
- یک ترمینالِ واقعی با **node-pty + xterm** — نه یک باکسِ لاگِ قلابی.
- چند نشستِ ترمینال با تب، دقیقاً داخل هر پروژه.

### 📦 Build و Setup
- **ویزاردِ بیلد** — واجدِ شرایط بودنِ بیلد را تشخیص بده، تارگت‌ها را تنظیم کن و
  خروجیِ پکیج‌شده همراه با checksum و manifest بساز _(Pro)_.
- **ساختِ پروژه‌ی جدید** با افزونه‌های اختیاری: Prettier، ESLint، React Router، Lucide،
  Zustand، TanStack Query، Vitest و پنلِ ادمینِ Decap CMS.

### 🩺 سلامت و سیستم
- **System Health** — پروژه‌ها را برای مشکلات اسکن کن و خلاصه‌ی سلامتِ هر پروژه را بگیر.
- **App & Tools** — ابزارهای رایجِ توسعه را تشخیص، نصب و حذف کن و سرویس‌های ویندوز را
  مدیریت کن.
- **پنل Git** — عملیاتِ رایجِ گیت برای هر پروژه، بدون خروج از اپ.

### 🗄️ داده و زیرساخت
- **یکپارچگی با Docker** — وضعیت را ببین، کانتینرها را لیست/مدیریت کن و کانتینر بساز.
- **دیتابیس‌ها** — دیتابیس لیست و ایجاد کن؛ استک‌های `docker compose` را مدیریت کن
  (up / down / ps / logs).
- **Connections** — اتصال‌های سرویس را ذخیره، تست و اعمال کن.

### 🎛️ راحتیِ کار
- **Command Palette** (`Ctrl+K`) و نقشه‌ی کاملِ میان‌برهای کیبورد (`Ctrl+/`).
- **ادیتورِ Env** برای فایل‌های `.env`، نمایشگرِ یکپارچه‌ی **Logs** و بازکردنِ یک‌کلیکی در
  **VS Code / Cursor** (یا دستورِ ادیتورِ دلخواهِ خودت).
- **tray** سیستم، **اعلان‌های** دسکتاپ، close-to-tray، اجرا هنگام بوت و شروعِ مینیمایز.
- یک رابطِ تیره‌ی frameless و تمیز.

### 🔄 آپدیتِ بی‌دردسر
- **آپدیت استاندارد با نصب‌کننده** — نسخه‌ای که با Setup نصب شده از مسیر رسمی
  `electron-updater` و NSIS به‌روزرسانی می‌شود؛ نصب‌کننده در پس‌زمینه دانلود، با
  متادیتای SHA-512 همان release تأیید، درجا نصب و سپس اپ دوباره اجرا می‌شود.

---

## 📥 دانلود و نصب

آخرین نسخه را از [**صفحه‌ی Releases**](https://github.com/MiladClark/devflow-project-mannager/releases/latest) بگیر:

| دانلود | مناسب برای |
| --- | --- |
| **نصب‌کننده** (`…-setup.exe`) | نصبِ معمولی — شورت‌کاتِ استارت‌منو و دسکتاپ می‌سازد. |
| **پرتابل** (`…-portable.zip`) | بدون نصب — unzip کن و اجرا کن؛ برای آپدیت، پوشه را دستی جایگزین کن. |

هر دو امکانات یکسان دارند، اما **نصب با Setup پیشنهاد می‌شود** و آپدیت خودکارِ درجا دارد.
نسخه‌ی پرتابل عمداً دستی آپدیت می‌شود تا updater هیچ پوشه‌ی دلخواه یا فلش را تغییر ندهد.

> ℹ️ بیلدها فعلاً **امضا نشده‌اند**، پس SmartScreenِ ویندوز ممکن است بارِ اول هشدار بدهد.
> **More info → Run anyway** را بزن.

---

## 🔐 پلن‌ها

استفاده از DevFlow نیازمندِ یک **حسابِ رایگانِ DevTune** است. با ورود، پلنِ رایگان باز
می‌شود؛ لایسنسِ Pro محدودیت‌ها را برمی‌دارد و امکاناتِ ویژه را فعال می‌کند.

| | **مهمان** (خارج‌شده) | **رایگان** | **Pro** |
| --- | :---: | :---: | :---: |
| دیدنِ رابطِ کاربری | ✅ | ✅ | ✅ |
| استفاده از هر امکان | ❌ | ✅ | ✅ |
| پروژه‌ها | — | ۳ | نامحدود |
| دستگاه‌ها | — | ۱ | نامحدود |
| نشست‌های ترمینال | — | ۱ | نامحدود |
| Build & Setup، Health Audit | — | ❌ | ✅ |
| بکاپِ ابری، Export/Import | — | ❌ | ✅ |
| اجرای خودکار، تمِ سفارشی، قالبِ پرمیوم | — | ❌ | ✅ |
| حالتِ تیمی، قالبِ اشتراکی، API، Webhooks | — | ❌ | ✅ |

پلنت را در **[devtune.app](https://devtune.app)** مدیریت کن.

---

## 🛠️ تک‌استک

| لایه | فناوری |
| --- | --- |
| پوسته | **Electron 43** (پنجره‌ی frameless سفارشی، tray، اعلان‌ها) |
| رابط | **React 19**، **React Router 7**، **Tailwind CSS 4**، **Zustand 5**، **Recharts 3**، **Lucide** |
| ترمینال | **node-pty** + **@xterm/xterm** |
| بیلد | **Vite 8** (Rolldown)، **TypeScript 7**، **electron-builder 26** |
| آپدیت | `electron-updater` و NSIS کاربرمحور روی GitHub Releases؛ سیاست از API دیوتیون |

---

## 👩‍💻 توسعه

**نیازمندی‌ها:** Node.js نسخه‌ی ۲۲ به بالا و npm.

```bash
# نصب وابستگی‌ها
npm install

# اجرا در حالت dev (ویت + الکترون با hot reload)
npm run dev

# بررسی تایپ
npm run typecheck

# بیلدِ پروداکشن (renderer + main + preload)
npm run build
```

### اسکریپت‌های کاربردی

| اسکریپت | کارش |
| --- | --- |
| `npm run dev` | اجرای اپ با hot reload. |
| `npm run build` | بررسی تایپ و بیلدِ renderer، main و preload. |
| `npm run package` | ساختِ اپِ پرتابل در پوشه‌ی `devflow/`. |
| `npm run package:zip` | zip کردنِ بیلدِ پرتابل برای توزیع. |
| `npm run build-icon` | بازسازیِ آیکون‌های اپ از آرتِ منبع. |

---

## 🏗️ معماری

```
electron/            # پروسه‌ی main (سمت Node)
├── main.ts          # چرخه‌ی حیات اپ، پنجره، tray، استارتاپ
├── preload.ts       # پلِ امنِ IPC (contextIsolation)
├── ipc/             # هندلرهای امکانات: projects، runner، terminal،
│                    #   docker، compose، git، health، build، updates، …
└── lib/             # منطقِ اصلی: تشخیص فریم‌ورک، لایسنس،
                     #   updater، stats، ports، store، tray، …

src/                 # renderer (ری‌اکت)
├── pages/           # Dashboard، Projects، Build & Setup، Logs،
│                    #   System Health، Database، Connections، …
├── components/      # اجزای رابطِ کاربری
├── state/           # استورِ Zustand
└── lib/             # کمکی‌های renderer (ipc، theme، nav، guest، …)
```

مسیرهای renderer **code-split** شده‌اند تا اپ سریع رندر شود — چانک‌های سنگین (نمودارها،
ترمینال) فقط وقتی صفحه‌شان باز شود لود می‌شوند.

---

## 📦 انتشار

انتشار کاملاً خودکار است. یک تگِ نسخه push کن و GitHub Actions بیلد، منتشر و ثبت می‌کند:

```bash
# ۱. مقدار "version" را در package.json بالا ببر (مثلاً 0.1.21 → 0.1.22)
# ۲. تگِ متناظر را بزن و push کن
git tag v0.1.22
git push origin v0.1.22
```

سپس CI زیپ پرتابل، Setup نوع NSIS، فایل `latest.yml` و blockmap را با هم می‌سازد و
اعتبارسنجی می‌کند، به‌عنوان یک GitHub Release منتشر می‌کند و بعد سیاست release را در API
دیوتیون ثبت می‌کند. نصب‌های Setup در اجرای بعدی آپدیت را خودکار دریافت می‌کنند.

<br />

<div align="center">

ساخته‌شده با ⚡ توسطِ **[DevTune](https://devtune.app)**

</div>

</div>
