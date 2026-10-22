# پلن جامع DevFlow Next

> نسخه سند: 1.0  
> مبنای بررسی: کد نسخه `0.1.27`  
> تاریخ بررسی: 2026-10-21  
> هدف محصول: ساده‌کردن چرخه کامل توسعه محلی برای برنامه‌نویس مبتدی تا حرفه‌ای، بدون قربانی‌کردن کنترل و شفافیت.

## وضعیت اجرای Release 0.1.28

در اجرای نخست این سند، موارد زیر تکمیل شده‌اند:

- آداپتور یکپارچه npm، pnpm، Yarn و Bun برای scaffold، install، add-on، run و Health.
- انتخاب package manager و نسخه/tag سازنده‌ی stack در Create Project.
- package manager پیش‌فرض در Onboarding و Settings.
- کنترل نسخه، scope، force reinstall و Update/Repair در Apps & Tools.
- اصلاح refresh شدن PATH پیش از verification ابزار تازه‌نصب‌شده.
- validation مرز IPC برای گزینه‌های نصب، stack version و ورودی‌های اصلی scaffold.
- تست واحد آداپتورها و CI پایه شامل install، test، typecheck و build.

موارد Releaseهای 0.2.0 به بعد، به‌خصوص Job Store پایدار، resume/retry مرحله‌ای، recipe engine، Secret Vault و Service Templates همچنان طبق نقشه راه ادامه دارند.

## 1. خلاصه اجرایی

DevFlow در وضعیت فعلی یک کنترل‌سنتر محلی قابل‌استفاده برای پروژه‌های JavaScript است: پروژه را import و اجرا می‌کند، پورت و process را می‌بیند، terminal و Git و env دارد، Docker و دیتابیس را مدیریت می‌کند و build می‌گیرد. مشکل اصلی کمبود صفحه یا دکمه نیست؛ قابلیت‌ها در چند موتور جدا و hard-coded پخش شده‌اند و هنوز یک مدل واحد برای «نصب و آماده‌سازی یک محیط توسعه» وجود ندارد.

مهم‌ترین نمونه: `pnpm`، `yarn` و `bun` در Tools و تشخیص پروژه وجود دارند، اما ساخت پروژه، نصب Tailwind و add-onها و بعضی health checkها همچنان مستقیماً `npm` را اجرا می‌کنند. اضافه‌کردن یک select ساده برای pnpm این مشکل را کامل حل نمی‌کند. DevFlow Next باید یک موتور نصب مرحله‌ای و قابل توسعه داشته باشد که runtime، package manager، framework، plugin، database، env، port و Git را در یک Install Plan هماهنگ کند.

اصل طراحی نسخه جدید:

**Simple by default, powerful on demand**

- کاربر مبتدی یک مسیر پیشنهادی، توضیح‌دار، امن و با auto-fix می‌بیند.
- کاربر متوسط می‌تواند انتخاب‌های اصلی مانند نسخه، package manager، دیتابیس و plugin را تغییر دهد.
- کاربر حرفه‌ای Advanced Mode، command preview، flags، provider، environment profile، dry-run و override کامل دارد.

## 2. وضعیت فعلی و یافته‌های قطعی

### نقاط قوت موجود

- معماری Electron با main/renderer جدا و preload محدود.
- تشخیص package manager از `packageManager` و lockfile برای npm، pnpm، yarn و bun.
- اجرای پروژه، build، script، terminal واقعی، Git، env editor و monitor در یک صفحه پروژه.
- تشخیص conflict پورت و امکان takeover.
- تشخیص framework، import تکی و scan پوشه.
- مدیریت MySQL/PostgreSQL محلی و Docker.
- اتصال دیتابیس و اعمال connection string روی env پروژه.
- build pipeline مرحله‌ای با preflight، checksum و manifest.
- نصب background ابزارها با log، cancel و verification.
- onboarding، command palette، shortcuts، backup و updater داخلی.

### شکاف‌های بحرانی P0

| حوزه | وضعیت فعلی | اثر | تصمیم نسخه جدید |
|---|---|---|---|
| ساخت پروژه | تمام create commandها و add-onها با npm و اغلب `latest` اجرا می‌شوند | انتخاب package manager و version واقعی نیست | Package Manager Adapter + Version Resolver |
| Tools | نصب عمدتاً winget latest یا `npm -g` است | نسخه، source، scope، update و repair قابل کنترل نیست | Tool Provider Engine |
| Health | `npm outdated` و `npm audit` برای همه پروژه‌ها اجرا می‌شود | نتیجه برای pnpm/yarn/bun ناقص یا غلط است | Health Adapter per package manager |
| Job state | وضعیت install در حافظه است | با restart اپ، history و resume از بین می‌رود | Persistent Job Store |
| Scaffold | یک process سراسری و مراحل hard-coded دارد | parallel job، retry مرحله‌ای و resume ندارد | DAG-based Install Plan |
| Secrets | پسورد connectionها در JSON اصلی ذخیره می‌شود | ریسک افشای credential | OS-backed Secret Vault |
| Database | image و نسخه ثابت، بدون volume/restart policy/backup | داده با چرخه عمر ضعیف و کنترل کم | Service Template + persistent volume |
| Storage | JSON بدون schema version و write اتمیک | migration و recovery شکننده است | Versioned store + atomic write |
| QA | تست خودکار وجود ندارد و CI فقط release است | regression نصب بسیار محتمل است | test pyramid + CI روی هر PR/push |

### نکته مهم درباره npm و pnpm

کد فعلی در `electron/lib/pkgmanager.ts` چهار package manager را می‌شناسد و پروژه‌های importشده را با manager درست اجرا می‌کند. ولی `ScaffoldOptions` اصلاً package manager یا version ندارد و `electron/ipc/scaffold.ts` برای Next، Vite، Electron، Payload، Strapi، Tailwind و pluginها npm را hard-code کرده است. بنابراین اولویت اول، اتصال یک selector به commandهای پراکنده نیست؛ اولویت ساخت abstraction واحد و استفاده از آن در تمام مسیرهاست.

## 3. تعریف دقیق محصول هدف

DevFlow Next باید این چرخه را از ابتدا تا انتها مدیریت کند:

1. بررسی سیستم و پیش‌نیازها.
2. انتخاب recipe یا ساخت stack سفارشی.
3. انتخاب runtime و نسخه آن.
4. انتخاب package manager و نسخه آن.
5. انتخاب framework/template و نسخه آن.
6. انتخاب packageها، pluginها و نسخه‌های سازگار.
7. ساخت یا اتصال database/cache/service.
8. تولید و اعتبارسنجی envها.
9. تخصیص port و local domain.
10. Git init، branch، remote و first commit اختیاری.
11. اجرای install با log، progress، cancel، retry و resume.
12. اجرای smoke test و health check.
13. ثبت manifest قابل بازتولید برای rebuild یا share.
14. مدیریت روزمره run/build/test/update/backup از همان پروژه.

## 4. تجربه کاربری Beginner تا Advanced

### Beginner Mode

- شروع با سؤال «چه چیزی می‌خواهی بسازی؟» به‌جای نمایش فهرست فنی طولانی.
- recipeهای محدود و مطمئن: Website، Dashboard، API، Full-stack app، Desktop app، CMS.
- badgeهای Recommended و توضیح ساده «مناسب چه کاری است؟».
- انتخاب خودکار نسخه‌های compatible و stable.
- بررسی خودکار Node، Git، package manager، Docker و port.
- دکمه Fix automatically برای پیش‌نیازهای کمبود.
- password امن auto-generate و مخفی.
- rollback امن در صورت شکست.
- صفحه پایان با سه اقدام واضح: Run، Open in Editor، View Project.

### Standard Mode

- انتخاب framework، package manager، database، styling، testing و state management.
- انتخاب channel نسخه: Recommended، Latest stable، LTS یا Exact.
- preview خلاصه stack و disk/network/admin requirements.
- ذخیره تنظیمات به‌عنوان preset شخصی.

### Advanced Mode

- exact version برای runtime/framework/package/plugin/tool.
- source/provider انتخابی و mirror/proxy تنظیم‌شده.
- install flags، environment variables و command override.
- command preview و copy plan قبل از اجرا.
- انتخاب stageها، skip و force با هشدار روشن.
- concurrency، timeout، retry policy و keep-partial-files.
- import/export recipe و manifest.

حالت کاربر باید preference باشد، نه paywall. قابلیت‌های ایمنی و انتخاب package manager نباید Pro-only شوند.

## 5. معماری هدف: Unified Setup Engine

### 5.1 مدل‌های اصلی

```ts
type VersionPolicy =
  | { mode: 'recommended' }
  | { mode: 'channel'; channel: 'lts' | 'stable' | 'latest' | 'next' }
  | { mode: 'exact'; version: string }

interface StackDefinition {
  id: string
  schemaVersion: number
  runtime: RuntimeRequirement[]
  packageManager: PackageManagerRequirement
  scaffold: ScaffoldDefinition
  addons: AddonDefinition[]
  services: ServiceDefinition[]
  envSchema: EnvFieldDefinition[]
  ports: PortRequirement[]
  healthChecks: HealthCheckDefinition[]
}

interface InstallPlan {
  id: string
  projectPath: string
  createdAt: number
  steps: InstallStep[]
  rollbackSteps: RollbackStep[]
  resolvedVersions: Record<string, string>
  requiredPrivileges: 'user' | 'admin' | 'mixed'
}

interface InstallJob {
  id: string
  planId: string
  state: 'queued' | 'running' | 'paused' | 'failed' | 'cancelled' | 'completed'
  currentStepId?: string
  attempts: number
  startedAt?: number
  finishedAt?: number
}
```

### 5.2 اجرای plan

هر نصب باید به stepهای typed تبدیل شود، نه رشته‌های command پراکنده:

- `preflight`
- `acquire-runtime`
- `activate-runtime-version`
- `acquire-package-manager`
- `scaffold-project`
- `install-dependencies`
- `apply-addon`
- `provision-service`
- `write-env`
- `reserve-port`
- `configure-git`
- `smoke-test`
- `import-project`
- `finalize-manifest`

هر step باید input/output، timeout، progress، retry، cancel behavior، rollback behavior و redaction rule داشته باشد.

### 5.3 قانون مهم اجرای command

- برای commandهای ساختاری از `spawn(executable, args, { shell: false })` استفاده شود.
- shell فقط برای command override صریح کاربر حرفه‌ای فعال شود.
- تمام ورودی‌های IPC با schema runtime اعتبارسنجی شوند.
- log قبل از ارسال به UI از secretها پاک‌سازی شود.
- command preview باید نسخه redacted داشته باشد.

### 5.4 Job Center

یک Job Center سراسری جای وضعیت‌های جداگانه Scaffold، Tools، Build و Docker را می‌گیرد:

- queue و ترتیب اجرا.
- progress واقعی step و کل job.
- pause در مرحله‌های قابل pause.
- cancel با kill process tree.
- retry فقط مرحله شکست‌خورده یا کل plan.
- resume بعد از restart اپ.
- history، duration، exit code و export log.
- notification و deep-link به job.
- جلوگیری از نصب‌های متعارض هم‌زمان.

## 6. Package Manager Matrix

Adapter مشترک باید تمام عملیات زیر را پیاده کند:

| عملیات | npm | pnpm | yarn | bun |
|---|---:|---:|---:|---:|
| detect/version | الزامی | الزامی | الزامی | الزامی |
| scaffold runner | الزامی | الزامی | الزامی | الزامی در template سازگار |
| install/frozen install | الزامی | الزامی | الزامی | الزامی |
| add/remove dependency | الزامی | الزامی | الزامی | الزامی |
| add/remove dev dependency | الزامی | الزامی | الزامی | الزامی |
| run script | الزامی | الزامی | الزامی | الزامی |
| outdated | الزامی | الزامی | الزامی | adapter-specific |
| audit | native یا fallback | native یا fallback | native یا fallback | native یا fallback |
| workspace filter | پشتیبانی | پشتیبانی | پشتیبانی | در صورت قابلیت |

قواعد:

- انتخاب manager در ویزارد ساخت پروژه الزامی است و مقدار پیش‌فرض از Settings می‌آید.
- نسخه manager باید قابل انتخاب باشد.
- `packageManager` در `package.json` pin شود تا پروژه reproducible باشد.
- lockfile درست تولید و lockfileهای ناسازگار حذف نشوند مگر با تأیید کاربر.
- Corepack یا روش رسمی manager در قالب provider استفاده شود؛ نصب global با npm فقط fallback است.
- تغییر manager در پروژه موجود یک migration جدا با preview، backup و rollback است.

## 7. مدیریت نسخه‌ها و compatibility

### Runtime

- Node: System، fnm، nvm، Volta؛ نصب نسخه missing، switch per project و نمایش active/required.
- Python و runtimeهای آینده باید از همان Runtime Provider استفاده کنند.
- `.nvmrc`، `.node-version`، `.tool-versions`، Volta و `engines` خوانده شوند.
- conflict بین فایل‌ها به‌صورت قابل‌فهم نمایش داده شود.

### Framework و CLI

- `latest` تنها گزینه نباشد.
- نسخه‌های Recommended، Stable و Exact در catalog تعریف شوند.
- قبل از نصب، compatibility runtime/framework/plugin بررسی شود.
- نسخه resolved در manifest ثبت شود؛ اجرای دوباره plan نباید بدون اجازه نسخه را تغییر دهد.

### Add-on و plugin

- هر add-on دارای supported frameworks، peer constraints، install packages، file transforms، scripts، env fields و health checks باشد.
- add-onها از union type و switch بزرگ خارج شوند و به manifestهای versioned منتقل شوند.
- transform فایل‌ها idempotent باشد؛ اجرای دوباره config را خراب نکند.

## 8. Stack Studio جدید

نام پیشنهادی برای بخش ساخت پروژه: **Stack Studio**. این بخش «Create Project» و بخش setup از Build & Setup را تفکیک و شفاف می‌کند.

### مراحل ویزارد

1. **Goal**: Website، API، Full-stack، Desktop، CMS یا Custom.
2. **Recipe**: انتخاب recipe پیشنهادی.
3. **Core**: runtime، framework، language، package manager و version policy.
4. **Features**: styling، routing، state، data fetching، lint، format و test.
5. **Data & Services**: database، cache، storage، mail و compose.
6. **Environment**: env profiles، secrets و generated values.
7. **Network**: ports، conflict policy و local HTTPS domain.
8. **Project**: name، path، Git و editor.
9. **Review**: dependency graph، resolved versions، commands، warnings و disk impact.
10. **Install**: stage progress و controls.
11. **Verify**: smoke test، health summary و next actions.

### recipeهای اولویت اول

#### Tier A — باید در اولین release پایدار شوند

- Next.js app
- Vite + React
- Vite + Vue
- Vite Vanilla
- Electron + React
- Payload CMS
- Strapi

#### Tier B — گسترش منطقی اکوسیستم JS

- Astro
- SvelteKit
- Nuxt
- Express API
- NestJS API

#### Tier C — Full-stack recipes

- Next.js + PostgreSQL + ORM recipe
- React + NestJS + PostgreSQL
- Nuxt + PostgreSQL
- Electron + SQLite
- Headless CMS + frontend جدا در یک workspace

پشتیبانی از stack جدید باید با اضافه‌کردن manifest/adapter ممکن باشد، نه تغییر چند فایل UI و backend.

## 9. بازطراحی Apps & Tools

### مشکلات فعلی

- version انتخاب نمی‌شود و اکثر نصب‌ها latest هستند.
- provider تقریباً فقط winget است؛ pnpm/yarn با npm global نصب می‌شوند.
- فقط Install، Uninstall و Cancel وجود دارد.
- Update، Repair، Reinstall، Change Version و Locate موجود نیست.
- dependency graph ابزارها وجود ندارد.
- وضعیت job با restart اپ از بین می‌رود.
- download progress واقعی نمایش داده نمی‌شود.
- PATH refresh و post-install activation کامل نیست.
- UAC فقط با یک hint مدیریت می‌شود.
- search، filter وضعیت و bulk action وجود ندارد.

### قابلیت هدف

- Search و فیلتر: Installed، Missing، Update available، Broken، Runtime، Database و Editor.
- نمایش Installed version، Recommended version، Latest version، source و install scope.
- عملیات Install، Update، Repair، Reinstall، Change version، Uninstall و Open location.
- provider adapter برای winget و providerهای مورد تأیید؛ manual installer فقط با checksum و metadata معتبر.
- انتخاب `user` یا `machine` در صورت پشتیبانی.
- preview نیاز به Admin قبل از شروع.
- dependency-aware queue؛ مثال: package manager قبل از Node نصب نشود.
- نصب bundleهایی مثل «JavaScript Starter»، «Full-stack Starter» و «Database Starter».
- post-install hooks: PATH refresh، version verify، service status و restart-required.
- هشدار dependency قبل از uninstall.
- rollback برای actionهای قابل rollback.

### Tool manifest پیشنهادی

```ts
interface ToolManifest {
  id: string
  category: string
  platforms: Platform[]
  detect: DetectionRule[]
  providers: ToolProviderDefinition[]
  versions: VersionSourceDefinition
  dependencies: ToolDependency[]
  capabilities: Array<'install' | 'update' | 'repair' | 'uninstall' | 'side-by-side'>
  verify: VerificationRule[]
  conflicts?: ConflictRule[]
}
```

## 10. ممیزی تب‌به‌تب و تغییر پیشنهادی

### Dashboard

وضعیت فعلی: آمار پروژه، سرویس‌های running، health کلی، resource و جدول پروژه‌ها.

تغییر:

- Quick Start برای Create/Import/Resume failed setup.
- Active Jobs و install/build progress.
- Attention Center برای port conflict، missing tool، env missing، failed health و update.
- نمایش workspace/stack status به‌جای تکیه صرف بر تعداد پروژه.
- widgetهای قابل hide/reorder برای کاربر حرفه‌ای.

### Projects

وضعیت فعلی: import، scan، create، search و bulk start/stop.

تغییر:

- tags، favorites، groups/workspaces و filters.
- تشخیص monorepo و packageهای داخل آن.
- stack summary شامل runtime، manager، framework، database و port.
- actionهای Setup/Repair/Upgrade/Clone.
- archive به‌جای remove ساده و نمایش missing path repair.
- multi-select برای health، deps install و version migration.

### Stack Studio / New Project

بزرگ‌ترین تغییر این نسخه است و طبق بخش‌های 5 تا 8 اجرا می‌شود. خروجی هر نصب باید `devflow.stack.json` یا manifest معادل داشته باشد تا setup بازتولیدپذیر شود.

### Project Detail

تب‌های فعلی Logs، Monitor، Terminal، Git، `.env`، Health، Scripts، Stack و Settings حفظ می‌شوند اما context و action مشترک می‌گیرند.

- **Overview جدید**: وضعیت کل stack، URLها، serviceها، versions و quick actions.
- **Logs**: source/level filter، structured events، persist اختیاری، export و secret redaction.
- **Monitor**: history طولانی‌تر، threshold alert، child process و service stats.
- **Terminal**: profile پیش‌فرض، project runtime activation و command snippets.
- **Git**: branch switch/create، diff preview، stash و conflict guidance در فاز بعد.
- **Env**: schema، required/missing، duplicate detection، compare profiles و secret references.
- **Health**: adapter manager، auto-fix plan، license/audit UX شفاف و cached result پایدار.
- **Scripts**: categories، argument input، concurrent tasks و task history.
- **Stack**: compose service actions per service، recreate/pull، health/log و dependencies.
- **Settings**: command builder، runtime/package manager migration و validation قبل از save.

### Logs سراسری

- ترکیب logهای project، tool install، scaffold، build، Docker و system job.
- فیلتر بر اساس source/job/project/time/severity.
- retention policy و سقف disk.
- export support bundle با redaction.

### System Health

وضعیت فعلی بیشتر process manager است و نام آن با Health پروژه تداخل مفهومی دارد.

تغییر:

- نام پیشنهادی: **System & Processes**.
- بخش Environment Doctor: PATH، runtime، package manager، Git، Docker، disk، proxy، certificates و permission.
- نمایش علت و اثر هر مشکل به زبان ساده.
- Fix action برای موارد امن و step-by-step instruction برای موارد دستی.
- kill process همچنان با process tree revalidation و confirmation بماند.

### Databases

وضعیت فعلی: MySQL/PostgreSQL محلی، Docker container و database creation.

تغییر:

- version/image selector.
- named volume الزامی به‌صورت پیش‌فرض.
- restart policy، auto-start، health check و resource limits.
- delete container با گزینه حفظ/حذف volume.
- backup/restore، export/import و reset.
- templateهای PostgreSQL، MySQL/MariaDB، Redis و SQLite؛ MongoDB بعد از تثبیت مدل.
- اتصال خودکار به project و تولید env.
- migration/seed command در recipe.
- جلوگیری از نمایش/ذخیره بی‌محافظت password.

### Connections

- credentialها از store اصلی به Secret Vault منتقل شوند.
- auth test واقعی برای connectionهای remote نیز با driver adapter انجام شود؛ TCP-only با badge محدودیت مشخص بماند.
- multiple env targets و preview diff قبل از apply.
- rotate password/secret reference.
- connection template و share بدون secret.

### Build & Release

بخش build موجود از نظر pipeline از scaffold بالغ‌تر است. تغییرات:

- نام از Build & Setup به **Build & Release** تا با Stack Studio قاطی نشود.
- استفاده از Job Center مشترک.
- platform/architecture matrix روشن.
- signing/notarization readiness checks.
- artifact retention و build history پایدار.
- reproducible mode با lockfile و resolved manifest.
- release hooks اختیاری بعد از تثبیت build محلی.

### Account

- نمایش روشن capabilityهای plan و علت lock شدن action.
- device/session management داخل context مناسب.
- diagnostics اتصال به DevTune و last successful sync.
- license failure نباید project data محلی را در معرض از دست رفتن قرار دهد.

### Settings

گروه‌بندی جدید:

1. General & Appearance
2. Projects & Workspaces
3. Runtime & Package Managers
4. Install Engine
5. Ports & Local Domains
6. Editors & Terminal
7. Docker & Services
8. Security & Secrets
9. Notifications
10. Backup & Data
11. Advanced & Diagnostics

تنظیمات جدید مهم: preferred package manager، version policy، default recipe، install concurrency، timeout، retry count، mirror/proxy، log retention، auto-fix policy و secret reveal timeout.

### Onboarding

onboarding فعلی بیشتر preferenceها را می‌پرسد. onboarding جدید باید ابتدا Environment Doctor را اجرا و یک سطح کاربری پیشنهاد کند:

- Beginner / Standard / Advanced.
- انتخاب ecosystem مورد استفاده.
- نصب یا اتصال ابزارهای ضروری.
- ساخت اولین پروژه آزمایشی اختیاری.
- ذخیره profile و امکان اجرای دوباره onboarding از Settings.

## 11. Environment، Port و Secret Management

### Environment profiles

- profileهای `development`، `test`، `staging` و custom.
- schema برای required/optional/default/secret/type.
- compare و copy بین profileها.
- validation URL، number، boolean، enum و port.
- generated secret و rotation.
- فایل‌های `.env*` همچنان source of truth پروژه هستند؛ DevFlow metadata جدا نگه می‌دارد.

### Port Registry

- registry سراسری شامل reserved، assigned، listening و preferred range.
- پیشنهاد خودکار پورت آزاد و lock موقت هنگام setup.
- conflict policy: Ask، Pick next free، Stop managed owner یا Fail.
- تخصیص چند پورت برای stackهای چندسرویسی.
- نمایش map پروژه ← service ← port ← URL/domain.

### Secret Vault

- استفاده از API امن سیستم‌عامل/Electron برای رمزکردن secrets در حالت at rest.
- store اصلی فقط `secretRef` داشته باشد.
- log redaction بر اساس secrets فعال.
- export backup بدون password پیش‌فرض؛ export شامل secret با encryption و passphrase.
- reveal با timeout و copy با پاک‌سازی clipboard در صورت امکان.

## 12. Plugin و Recipe System

دو مفهوم جدا لازم است:

- **Addon**: تغییری داخل پروژه مانند ESLint، Vitest یا Zustand.
- **DevFlow Plugin**: افزونه‌ای برای خود اپ که provider، recipe، health check یا UI contribution اضافه می‌کند.

فاز اول فقط addon/recipe manifest داخلی و امضاشده اجرا شود. اجرای plugin ثالث تا قبل از sandbox، permission model، signing و review process فعال نشود.

Permissionهای آینده:

- filesystem scopes
- network domains
- process execution
- secret access
- Docker access
- UI contribution

## 13. امنیت، پایداری و data integrity

### اقدامات اجباری قبل از گسترش feature

- schema validation تمام payloadهای IPC.
- whitelist patchهای Project و Settings.
- حذف shell از commandهای ساختاری و جداسازی executable/args.
- path containment برای تمام file operations.
- secret vault و redaction.
- atomic store write با temp + rename و backup آخرین نسخه سالم.
- `schemaVersion` و migrationهای تست‌شده.
- import backup در staging memory، validate کامل، سپس commit اتمیک؛ replace فعلی نباید قبل از اعتبارسنجی کامل داده‌ها را حذف کند.
- checksum/signature برای catalog، recipe و installer metadata.
- pin و verify نسخه dependencyهای release pipeline.
- ثبت audit event برای install/uninstall/delete/takeover/secret apply.

## 14. کیفیت، تست و observability

در وضعیت فعلی فایل تست وجود ندارد و CI فقط هنگام tag شدن release اجرا می‌شود. اجرای typecheck محلی این ممیزی نیز به‌دلیل نبودن `node_modules` ممکن نشد؛ این یک خطای کد اثبات‌شده نیست، اما نشان می‌دهد validation قابل اتکای checkout حاضر فراهم نیست.

### حداقل test pyramid

- unit: version resolver، command adapter، detection، manifest validation، port allocation و redaction.
- contract: هر package manager و tool provider با fixture command runner.
- integration: IPC handlers با temp project و fake binaries.
- E2E Electron: create/import/run/stop/install cancel/retry و persistence بعد از relaunch.
- golden fixtures: framework/package.json/lockfileهای مختلف.
- destructive tests: rollback، failed backup import، failed env write و killed installer.

### CI لازم

- install با lockfile.
- typecheck.
- lint.
- unit/integration tests.
- build renderer/main/preload.
- smoke package روی Windows.
- dependency/security scan.
- release job فقط پس از عبور workflow اصلی.

### معیارهای محصول

- موفقیت setup recipeهای Tier A حداقل 95٪ در محیط‌های پشتیبانی‌شده.
- cancel بدون orphan process و بدون project ثبت‌شده ناقص.
- resume job پس از restart اپ.
- صفر secret در log و backup عادی.
- تشخیص package manager و اجرای health سازگار برای fixtureهای اصلی.
- زمان رسیدن کاربر مبتدی از نصب DevFlow تا اجرای اولین پروژه قابل اندازه‌گیری باشد.

## 15. نقشه راه اجرایی

### Release 0.1.28 — Stabilization (P0)

- رفع Health برای package managerهای مختلف.
- اضافه‌کردن package manager به `ScaffoldOptions` و حذف npm hard-code از مسیرهای مشترک.
- preflight روشن برای Node، manager، disk، network و permission.
- اصلاح install verification/PATH refresh.
- اضافه‌کردن CI پایه: typecheck + build.
- اضافه‌کردن تست‌های adapter و detection.

معیار خروج: ساخت Next و Vite با npm و pnpm از ابتدا تا اجرا موفق باشد و Health manager اشتباه اجرا نکند.

### Release 0.2.0 — Setup Engine Foundation (P0)

- مدل StackDefinition، InstallPlan، InstallJob و step runner.
- persistent Job Store و Job Center.
- PackageManagerAdapter چهارگانه.
- Runtime/Version Resolver.
- command safety و IPC validation.
- migration store و atomic writes.

معیار خروج: یک plan بعد از بسته و باز شدن اپ resume شود؛ retry مرحله شکست‌خورده کار کند؛ manifest نسخه‌های resolved را ثبت کند.

### Release 0.3.0 — Stack Studio (P1)

- UI سه‌سطحی Beginner/Standard/Advanced.
- مهاجرت recipeهای Tier A به manifest.
- version selector و compatibility checks.
- dry-run، command preview، preset و final smoke test.
- Git و port در plan.

معیار خروج: هیچ recipe Tier A مستقیماً npm یا latest را در backend hard-code نکند.

### Release 0.4.0 — Tools & Environment (P1)

- Tool Provider Engine.
- version/source/scope selector.
- update/repair/reinstall/change-version.
- Environment Doctor و auto-fix plan.
- Secret Vault و env schema/profile.
- log redaction.

معیار خروج: نصب tool از UI دارای resolved version، provider، verify result و history پایدار باشد.

### Release 0.5.0 — Data & Services (P1)

- Service templates با version، volume، health و restart policy.
- اتصال database به setup plan.
- backup/restore و delete-safe flow.
- port registry چندسرویسی.
- connection auth adapters و secret references.

معیار خروج: recipe full-stack دیتابیس را با volume می‌سازد، env را اعمال می‌کند و smoke test connection می‌گیرد.

### Release 0.6.0 — Project Lifecycle (P2)

- package explorer: install/update/remove/migrate.
- workspace/monorepo model.
- task runner و service dependency graph.
- unified logs و support bundle.
- project repair/upgrade flow.

### Release 0.7.0 — Ecosystem Expansion (P2)

- recipeهای Tier B و Tier C منتخب.
- recipe import/export.
- addon catalog امضاشده.
- diagnostics و telemetry کاملاً opt-in برای success/failure rate.

### Release 1.0 — GA Gate

- مستندات Beginner و Advanced.
- compatibility matrix منتشرشده.
- recovery و migration تست‌شده از نسخه‌های قبلی.
- installer امضاشده یا برنامه روشن signing.
- crash recovery، update rollback و support bundle.
- performance و accessibility pass.

## 16. ترتیب backlog پیشنهادی

| ID | کار | اولویت | اندازه نسبی | وابستگی |
|---|---|---:|---:|---|
| ENG-001 | PackageManagerAdapter | P0 | L | — |
| ENG-002 | Version Resolver | P0 | L | ENG-001 |
| ENG-003 | Install Plan/Step Runner | P0 | XL | — |
| ENG-004 | Persistent Job Store | P0 | L | ENG-003 |
| ENG-005 | Job Center UI | P0 | L | ENG-004 |
| SEC-001 | IPC schemas و whitelist | P0 | L | — |
| SEC-002 | Secret Vault و redaction | P0 | XL | — |
| DATA-001 | Versioned atomic store | P0 | L | — |
| QA-001 | CI typecheck/build/test | P0 | M | — |
| QA-002 | fixture command runner | P0 | L | ENG-001 |
| UX-001 | User level modes | P1 | M | — |
| STACK-001 | StackDefinition schema | P0 | L | ENG-003 |
| STACK-002 | Tier A recipe migration | P1 | XL | STACK-001, ENG-001 |
| TOOL-001 | Tool provider schema | P1 | L | ENG-003 |
| TOOL-002 | version/update/repair UX | P1 | L | TOOL-001, ENG-002 |
| ENV-001 | Environment Doctor | P1 | L | TOOL-001 |
| ENV-002 | env schema/profile | P1 | L | SEC-002 |
| DB-001 | Service template engine | P1 | XL | ENG-003 |
| DB-002 | persistent volumes/backup | P1 | L | DB-001 |
| PORT-001 | multi-service port registry | P1 | L | ENG-003 |
| PROJ-001 | workspace/monorepo model | P2 | XL | DATA-001 |
| LOG-001 | unified persistent logs | P2 | L | ENG-004, SEC-002 |

## 17. کارهایی که فعلاً نباید انجام شوند

- اضافه‌کردن ده‌ها framework قبل از تکمیل engine و adapterها.
- marketplace plugin ثالث بدون permission و signing model.
- cloud/team feature قبل از پایدارشدن چرخه محلی.
- نصب خودکار Admin-level بدون preview و consent.
- مخفی‌کردن command و error از کاربر حرفه‌ای.
- قرار دادن package manager، safety check یا recovery پشت پلن پولی.
- نگهداری secret در store یا log برای راحتی توسعه.

## 18. Definition of Done هر قابلیت نصب

یک قابلیت نصب زمانی Done است که:

- Beginner flow و Advanced flow مشخص دارد.
- preflight و compatibility check دارد.
- نسخه resolved و source معلوم است.
- commandها typed و validate شده‌اند.
- progress و log redacted دارد.
- cancel process tree را می‌بندد.
- retry/resume رفتار تعریف‌شده دارد.
- rollback یا پیام دقیق درباره چیزهای باقی‌مانده دارد.
- نتیجه verify و smoke test می‌شود.
- state بعد از restart قابل بازیابی است.
- unit و integration test دارد.
- خطا برای کاربر مبتدی قابل‌فهم و برای حرفه‌ای دارای detail فنی است.

## 19. تصمیم محصول نهایی

DevFlow نباید صرفاً «لانچر پروژه» یا «نصاب چند ابزار» باشد. جایگاه درست آن یک **Local Development Environment Orchestrator** است: کاربر هدفش را انتخاب می‌کند، DevFlow plan سازگار و قابل مشاهده می‌سازد، سیستم را آماده می‌کند، پروژه و سرویس‌ها را بالا می‌آورد و در ادامه همان stack را مدیریت، تعمیر، upgrade، monitor و build می‌کند.

اولویت نسخه بعدی تعداد framework بیشتر نیست؛ اولویت، ساخت foundation واحدی است که npm/pnpm/yarn/bun، نسخه‌های مختلف، Tools، database، env و ports را با رفتار امن و قابل بازتولید مدیریت کند. بعد از آن توسعه تعداد stackها سریع‌تر و کم‌ریسک‌تر خواهد شد.
