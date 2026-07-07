/**
 * Build portable app dir and copy to devflow/ (same layout as post-install).
 */
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rcedit } from "rcedit";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staging = path.join(root, "release", "win-unpacked");
const out = path.join(root, "devflow");
const iconPath = path.join(root, "build", "icon.ico");

function productExeName() {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  return `${pkg.productName ?? pkg.name}.exe`;
}

const iconBuild = spawnSync("node", ["scripts/build-icon.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
if (iconBuild.status !== 0) process.exit(iconBuild.status ?? 1);

process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";

const build = spawnSync("npx", ["electron-builder", "--dir"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (!existsSync(staging)) {
  console.error("Missing staging dir:", staging);
  process.exit(1);
}

const exePath = path.join(staging, productExeName());
if (!existsSync(exePath)) {
  console.error("Missing executable:", exePath);
  process.exit(1);
}
if (!existsSync(iconPath)) {
  console.error("Missing icon:", iconPath);
  process.exit(1);
}

await rcedit(exePath, { icon: iconPath });
console.log(`Embedded icon into ${exePath}`);

if (existsSync(out)) {
  rmSync(out, { recursive: true, force: true });
}

cpSync(staging, out, { recursive: true });

try {
  rmSync(path.join(root, "release"), { recursive: true, force: true });
} catch (err) {
  const code = err && typeof err === "object" && "code" in err ? err.code : "";
  if (code === "EPERM" || code === "EBUSY") {
    console.warn("Could not remove release/ (in use). Portable app is still in devflow/.");
  } else {
    throw err;
  }
}

console.log(`Portable app ready: ${out}`);
