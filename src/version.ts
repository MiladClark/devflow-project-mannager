// Injected at build time from package.json by Vite's `define` (see vite.config.ts).
// Never hardcode the version here — it would drift from the real release.
declare const __APP_VERSION__: string

export const APP_VERSION = __APP_VERSION__
