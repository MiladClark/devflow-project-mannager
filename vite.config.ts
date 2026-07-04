import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: { build: { outDir: 'dist-electron' } },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: { build: { outDir: 'dist-electron' } },
      },
    }),
  ],
  // PORT lets the preview harness relocate the dev server when 3007 is taken (autoPort)
  server: { port: Number(process.env.PORT) || 3007, strictPort: true },
  build: { outDir: 'dist' },
})
