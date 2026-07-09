# Code signing & the SmartScreen warning

## Honest answer (no Azure / no paid cert)

**There is no free way to fully remove** Windows “Unknown publisher / Windows protected your PC” for a normal desktop EXE you host yourself.

| Approach | Cost | Clears SmartScreen? |
|----------|------|---------------------|
| Do nothing (current local builds) | Free | No |
| Self-signed certificate | Free | No — Windows still treats it as untrusted |
| Azure Trusted Signing | Paid (~subscription) | Yes (after setup) — **you said you don’t want this** |
| OV code-signing cert (DigiCert, Sectigo, SSL.com, …) | Paid yearly | Eventually / with reputation |
| EV code-signing cert | Paid yearly (higher) | Usually yes, quickly |
| Microsoft Store | Store fees / account | Different trust model |

So if you **won’t pay Azure and won’t buy any cert**, the warning will stay. That is a Windows policy, not something DevFlow can patch in code.

What we *did* wire in the repo: optional signing when **you** later provide a PFX (or Azure). Local builds stay unsigned and still work.

---

## What the build does

| Step | Behavior |
|------|----------|
| `make-release.mjs` / `package-portable.mjs` | After icon embed, calls `scripts/sign-windows.mjs` |
| No credentials | Warns and continues **unsigned** (fine for you) |
| `SIGNING_REQUIRED=1` | Fail if unsigned — only use if you later buy a cert |
| Auto-updater | Requires SHA-256 checksum on updates |

---

## If you later buy a normal cert (not Azure)

Buy an **OV or EV code signing** certificate as a `.pfx`, then:

```bat
set WIN_CSC_LINK=C:\certs\devflow-codesign.pfx
set WIN_CSC_KEY_PASSWORD=********
build-release.bat --same
```

Or:

```bat
npm run sign:windows -- --require "path\to\DevFlow Manager.exe"
```

Also set `SIGNING_REQUIRED=1` on any machine that must never ship unsigned.

---

## Azure Trusted Signing (skip if you don’t want to pay)

Documented only for completeness. Needs a paid Azure Trusted Signing account + Client Tools + env vars `AZURE_TRUSTED_SIGNING_*`. You can ignore this entirely.

---

## Practical tips without signing

- Tell users: click **More info → Run anyway** (expected for unsigned apps).
- Prefer distributing a **ZIP portable** or installer with clear publisher name in your website copy (doesn’t remove SmartScreen, reduces support confusion).
- Keep update **checksums** required (already done) so unsigned updates aren’t silently swapped.

## Policy flags

| Variable | Effect |
|----------|--------|
| `SIGNING_SKIP=1` | Never attempt signing |
| `SIGNING_REQUIRED=1` | Fail build if signing fails (don’t set this if you have no cert) |
| `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` | PFX signing |
| `SIGNTOOL_PATH` | Override `signtool.exe` |

---

**Bottom line:** Without paying for Azure *or* a code-signing certificate, leave builds unsigned and accept SmartScreen. The tooling is ready for a PFX whenever you decide to buy one.
