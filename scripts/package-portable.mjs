/**
 * Build portable app dir and copy to devflow/ (same layout as post-install).
 */
import { cpSync, existsSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staging = path.join(root, "release", "win-unpacked");
const out = path.join(root, "devflow");

const iconSrc = path.join(root, "roadmap-and-design", "icon.ico");
const buildDir = path.join(root, "build");
if (!existsSync(iconSrc)) {
  console.error("Missing app icon:", iconSrc);
  process.exit(1);
}
mkdirSync(buildDir, { recursive: true });
cpSync(iconSrc, path.join(buildDir, "icon.ico"));

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
