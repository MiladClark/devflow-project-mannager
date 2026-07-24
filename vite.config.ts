import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

// Single source of truth for the app version: package.json. Injected at build
// time so the splash/loading screen never drifts from the real release version.
const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        // node-pty is a native module — must stay external to the bundle.
        // Vite 8 / Rolldown emits main.js plus sibling CJS chunks in
        // dist-electron/; they resolve via relative require and are all bundled
        // into the asar (files: dist-electron/**), so this is safe.
        vite: {
          build: {
            outDir: 'dist-electron',
            // node-pty is a native module and MUST stay external — if bundled,
            // its internal `require('./prebuilds/<plat>/<name>.node')` resolves
            // relative to the bundle in dist-electron/ instead of
            // node_modules/node-pty/ and fails to load (breaks the terminal AND
            // the PTY-based scaffolder). This MUST live under `rolldownOptions`,
            // not `rollupOptions`: vite-plugin-electron's defaults create
            // `build.rolldownOptions` on Vite 8, and it reads
            // `rolldownOptions || rollupOptions` — so an external placed in
            // `rollupOptions` is silently ignored and node-pty gets bundled.
            rolldownOptions: {
              external: ['node-pty', /[\\/]node-pty[\\/]/, /\.node$/],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: { build: { outDir: 'dist-electron' } },
      },
    }),
  ],
  // PORT lets the preview harness relocate the dev server when 3007 is taken (autoPort)
  server: { port: Number(process.env.PORT) || 3007, strictPort: true },
  build: {
    outDir: 'dist',
    // Split heavy/stable deps into their own chunks so the initial paint
    // downloads/parses less and vendor code stays cached across app updates.
    rollupOptions: {
      output: {
        // Vite 8 bundles with Rolldown, which requires manualChunks as a
        // function (the object form is no longer supported).
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor'
          }
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|decimal\.js-light)[\\/]/.test(id)) {
            return 'charts'
          }
          if (id.includes('@xterm')) return 'terminal'
        },
      },
    },
  },
})
