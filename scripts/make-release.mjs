/**
 * One-shot release build. Produces a self-contained portable folder named
 * "<ProductName>-<version>" placed in the SAME location as the release ZIPs
 * (the updates repo `.staging/` by default), with the brand icon embedded so the
 * EXE, taskbar and system-tray all show it correctly.
 *
 * Steps: clean → icon → typecheck → vite build → electron-builder --dir →
 *        embed exe icon (rcedit) → copy to <staging>/<ProductName>-<version>/
 *
 * Usage:
 *   node scripts/make-release.mjs                     # default staging dir
 *   node scripts/make-release.mjs --out-dir "D:\releases"
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { rcedit } from "rcedit";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const productName = pkg.productName ?? pkg.name;
const exeName = `${productName}.exe`;

// --- resolve the output location (same place the release ZIPs are stored) ---
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
function hasFlag(name) {
  return args.includes(name);
}

// --- decide the version: every build bumps the app version (auto +1) ---
const currentVersion = pkg.version;
function bumpPatch(v) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : v;
}
const nextVersion = bumpPatch(currentVersion);
function isValidVersion(v) {
  return /^\d+\.\d+\.\d+([-.].+)?$/.test(v.trim());
}
async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
async function resolveVersion() {
  // non-interactive escape hatches for automation
  const forced = arg("--version", null);
  if (forced) {
    if (!isValidVersion(forced)) { console.error(`✗ Invalid version: "${forced}"`); process.exit(1); }
    return forced;
  }
  if (hasFlag("--same") || hasFlag("--no-bump")) return currentVersion; // rebuild in place
  if (hasFlag("--auto") || hasFlag("--new") || hasFlag("--replace")) return nextVersion;
  // no TTY (double-click gives one; CI/pipe does not) → auto-increment
  if (!process.stdin.isTTY) return nextVersion;

  console.log(`\n  Current version: ${currentVersion}`);
  console.log(`  [N] New version — type it   (default ${nextVersion})`);
  console.log(`  [R] Auto +1     — bump to   ${nextVersion}`);
  const choice = (await prompt(`  Choice [N/R]: `)).toLowerCase();
  if (choice === "n" || choice === "new") {
    let v = await prompt(`  New version (Enter for ${nextVersion}): `);
    if (!v) return nextVersion;
    while (!isValidVersion(v)) {
      v = await prompt(`  Invalid. Enter like 0.1.6 (Enter for ${nextVersion}): `);
      if (!v) return nextVersion;
    }
    return v;
  }
  // R or Enter → auto +1
  return nextVersion;
}

const version = await resolveVersion();
if (version !== currentVersion) {
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`  → app version: ${currentVersion} → ${version}`);
} else {
  console.log(`  → app version: ${version} (rebuilt in place)`);
}
// keep the renderer's displayed version (Sidebar/Splash) in sync with package.json
const versionTsPath = path.join(root, "src", "version.ts");
writeFileSync(versionTsPath, `export const APP_VERSION = '${version}'\n`);
console.log(`  → src/version.ts synced to ${version}`);
const defaultStaging = path.resolve(root, "..", "devflow-app-updates", "devflow-app-updates", ".staging");
const outDir = path.resolve(
  arg("--out-dir", process.env.UPDATES_REPO ? path.join(process.env.UPDATES_REPO, ".staging") : defaultStaging)
);
const folderName = `${productName.replace(/\s+/g, "-")}-${version}`; // e.g. DevFlow-Manager-0.1.4
const targetDir = path.join(outDir, folderName);

// --- helpers ---
function step(label) {
  console.log(`\n→ ${label}`);
}
function run(cmd, cmdArgs, extraEnv) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32", // resolve npx/vite .cmd shims on Windows
    env: { ...process.env, ...(extraEnv || {}) },
  });
  if (r.status !== 0) {
    console.error(`\n✗ Step failed: ${cmd} ${cmdArgs.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

console.log(`\n▶ Building ${productName} v${version}`);
console.log(`  output: ${targetDir}`);

step("Cleaning previous build artifacts");
run("node", ["scripts/clean-build.mjs"]);

// regenerate icons only when the prebuilt ones are missing (design sources may
// not be present, and build/icon.* are the source of truth once generated)
if (existsSync(path.join(root, "build", "icon.ico")) && existsSync(path.join(root, "build", "icon.png"))) {
  step("Brand icons already present (build/icon.ico + icon.png) — skipping regeneration");
} else {
  step("Building brand icons (build/icon.ico + icon.png)");
  run("node", ["scripts/build-icon.mjs"]);
}

step("Type-checking");
run("npx", ["tsc", "--noEmit"]);

step("Bundling renderer + electron (vite build)");
run("npx", ["vite", "build"]);

step("Packaging portable app (electron-builder --dir)");
run("npx", ["electron-builder", "--dir"], { CSC_IDENTITY_AUTO_DISCOVERY: "false" });

// --- verify + embed icon into the EXE (taskbar / file icon) ---
const staging = path.join(root, "release", "win-unpacked");
const exePath = path.join(staging, exeName);
const iconPath = path.join(root, "build", "icon.ico");
if (!existsSync(exePath)) {
  console.error("✗ Missing executable:", exePath);
  process.exit(1);
}
if (!existsSync(iconPath)) {
  console.error("✗ Missing icon:", iconPath);
  process.exit(1);
}
step("Embedding brand icon into the EXE (taskbar + file icon)");
await rcedit(exePath, { icon: iconPath });

// --- copy the finished app into the versioned release folder ---
step(`Writing release folder: ${folderName}`);
mkdirSync(outDir, { recursive: true });
if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
cpSync(staging, targetDir, { recursive: true });

// tidy the intermediate build dir (best-effort)
try {
  rmSync(path.join(root, "release"), { recursive: true, force: true });
} catch {
  /* may be locked if the app is running — harmless */
}

console.log(`\n✅ Release ready:\n   ${targetDir}`);
console.log(`   Run:  "${path.join(targetDir, exeName)}"\n`);
