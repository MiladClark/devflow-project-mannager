# Code signing & the "unknown publisher" download warning

## Why the warning appears

Every DevFlow Manager artifact we ship today is **unsigned**:

- `electron-builder.yml` (`win` block) has no `certificateFile` / `signtool` config — target is `dir` only.
- Builds run with signing explicitly disabled: `CSC_IDENTITY_AUTO_DISCOVERY: "false"` in `scripts/make-release.mjs` and `scripts/package-portable.mjs`.
- The Inno Setup installer (`…/.staging/DevFlow-Manager-<ver>/setup.iss`) has no `SignTool` directive, so `DevFlowManager-Setup.exe` is unsigned too.
- The only integrity check in the auto-updater is an **optional** server-supplied SHA-256 (`electron/lib/updater.ts` — `if (info.checksum)`).

Because the EXE carries no Authenticode signature and no SmartScreen reputation, Windows shows **"Windows protected your PC / unknown publisher"** on download and first run. This is expected for any unsigned executable — it is not a false positive and cannot be fixed with metadata (publisher name, icon, etc.) alone.

## The production fix (recommended order)

### 1. Azure Trusted Signing — recommended
Microsoft's cloud signing service. Cheapest path to a **trusted-immediately** signature (no EV hardware token, no HSM).

- ~US$10/month, identity validation required (individual or organization).
- Signs in CI with `signtool` + the Trusted Signing dlib; no cert file to store.
- Certificates are short-lived and rotated by Azure — nothing to renew manually.
- Gives SmartScreen reputation quickly because the root is Microsoft-operated.

### 2. EV / OV code-signing certificate — alternative
From DigiCert, Sectigo, SSL.com, etc.

- **EV** (~US$250–400/yr, hardware token or cloud HSM): trusted by SmartScreen essentially immediately.
- **OV** (~US$120–200/yr): cheaper, but SmartScreen reputation **ramps over time / download volume** — early users may still see the warning for a while.

## Where to wire it later (no changes made yet)

When a certificate/Trusted Signing account exists:

1. **App EXE — `scripts/make-release.mjs`**
   Add a `signtool` step **after** the `rcedit` icon embed and **before** copying to the staging folder:
   ```
   signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 <options> "release/win-unpacked/DevFlow Manager.exe"
   ```
   Remove `CSC_IDENTITY_AUTO_DISCOVERY: "false"` (or replace with real `CSC_LINK`/`CSC_KEY_PASSWORD` for a cert file), or use electron-builder's `win.certificateFile` / `win.signtoolOptions` instead of a manual step.

2. **Installer — `setup.iss`**
   Register a sign tool in Inno Setup, then add to `[Setup]`:
   ```
   SignTool=signtool $f
   SignedUninstaller=yes
   ```
   (Configure the `signtool` command once under Tools → Configure Sign Tools in the Inno IDE, or `iscc /Ssigntool=...`.)

3. **Update ZIP payload**
   Sign the packaged EXE **before** `scripts/package-zip.mjs` zips it, so OTA updates are signed too.

4. **Harden the updater** (`electron/lib/updater.ts`)
   Once payloads are signed, make the checksum **required** instead of optional — change the `if (info.checksum)` guard to reject updates that don't provide a matching SHA-256.

## Quick reference — what stays unsigned until this is done
- `DevFlow Manager.exe` (portable / unpacked)
- `DevFlowManager-Setup.exe` (Inno installer)
- `devflow-<version>-win-x64.zip` (OTA update payload)

All three need the same certificate; sign the EXE first, then package/installer around it.
