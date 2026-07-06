import type { ReactNode } from 'react'

export type ScaffoldPluginLogoId =
  | 'prettier'
  | 'eslint-logo'
  | 'vitest'
  | 'react-router'
  | 'pinia'
  | 'lucide'
  | 'zustand'
  | 'tanstack-query'

export type TechLogoId =
  | 'next'
  | 'vite'
  | 'react'
  | 'vue'
  | 'vanilla'
  | 'cms-none'
  | 'payload'
  | 'strapi'
  | 'decap'
  | 'electron'
  | ScaffoldPluginLogoId

const brandBg: Partial<Record<TechLogoId, string>> = {
  next: 'bg-black',
  vite: 'bg-[#646cff]/15',
  react: 'bg-[#20232a]',
  vue: 'bg-[#42b883]/15',
  vanilla: 'bg-[#646cff]/15',
  'cms-none': 'bg-slate-800',
  payload: 'bg-black',
  strapi: 'bg-[#4945ff]/15',
  decap: 'bg-[#00c7b7]/15',
  electron: 'bg-[#47848f]/20',
  prettier: 'bg-[#1a2b34]',
  'eslint-logo': 'bg-[#4b32c3]/15',
  vitest: 'bg-[#729b1a]/15',
  'react-router': 'bg-[#ca4245]/15',
  pinia: 'bg-[#ffd859]/15',
  lucide: 'bg-slate-800',
  zustand: 'bg-[#443c38]',
  'tanstack-query': 'bg-[#ff4154]/15',
}

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {children}
    </svg>
  )
}

function LogoMark({ id }: { id: TechLogoId }) {
  switch (id) {
    case 'next':
      return (
        <Svg className="h-6 w-6">
          <path fill="#fff" d="M11.5 2.5 3 19.5h3.2l1.4-3.2h8.8l1.4 3.2H21L12.5 2.5h-1Zm-.8 11.2 3.2-7.4 3.2 7.4H10.7Z" />
        </Svg>
      )
    case 'vite':
      return (
        <Svg className="h-6 w-6">
          <path
            fill="url(#vite-a)"
            d="m12 2.5 7.8 13.5H15.6L12 7.8 8.4 16H4.2L12 2.5Z"
          />
          <path fill="url(#vite-b)" d="M12 2.5 8.4 16h3.6L12 10.2 15.6 16H19.8L12 2.5Z" />
          <defs>
            <linearGradient id="vite-a" x1="4" x2="20" y1="3" y2="16" gradientUnits="userSpaceOnUse">
              <stop stopColor="#41d1ff" />
              <stop offset="1" stopColor="#bd34fe" />
            </linearGradient>
            <linearGradient id="vite-b" x1="8" x2="20" y1="3" y2="16" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffea83" />
              <stop offset=".08" stopColor="#ffdd35" />
              <stop offset="1" stopColor="#ffa800" />
            </linearGradient>
          </defs>
        </Svg>
      )
    case 'react':
      return (
        <Svg className="h-6 w-6">
          <circle cx="12" cy="12" r="2.2" fill="#61dafb" />
          <ellipse cx="12" cy="12" rx="10" ry="3.8" fill="none" stroke="#61dafb" strokeWidth="1.1" />
          <ellipse cx="12" cy="12" rx="10" ry="3.8" fill="none" stroke="#61dafb" strokeWidth="1.1" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="3.8" fill="none" stroke="#61dafb" strokeWidth="1.1" transform="rotate(120 12 12)" />
        </Svg>
      )
    case 'vue':
      return (
        <Svg className="h-6 w-6">
          <path fill="#42b883" d="M12 3 4 19h4.5l3.5-6.5L15.5 19H20L12 3Z" />
          <path fill="#35495e" d="M12 8.2 9.8 12.5H14.2L12 8.2Z" />
        </Svg>
      )
    case 'vanilla':
      return (
        <Svg className="h-6 w-6">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="#f7df1e" />
          <path fill="#323330" d="M8.5 10h2.2l.4 5.2 2.4-4.4 2.4 4.4.4-5.2H16l-.9 10.5h-1.8l-2-3.6-2 3.6H9.4L8.5 10Z" />
        </Svg>
      )
    case 'cms-none':
      return (
        <Svg className="h-6 w-6 text-slate-400">
          <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
          <path fill="currentColor" d="M9 12h6" stroke="currentColor" strokeWidth="1.5" />
        </Svg>
      )
    case 'payload':
      return (
        <Svg className="h-6 w-6">
          <rect x="4" y="4" width="16" height="16" rx="3" fill="#fff" />
          <path fill="#000" d="M8 8h8v2H8V8Zm0 3.5h8v2H8v-2Zm0 3.5h5.5v2H8v-2Z" />
        </Svg>
      )
    case 'strapi':
      return (
        <Svg className="h-6 w-6">
          <path fill="#4945ff" d="M12 3 5 7v10l7 4 7-4V7l-7-4Zm0 2.2 4.8 2.7v5.4L12 16.8 7.2 14V7.9 12 5.2Z" />
          <path fill="#fff" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        </Svg>
      )
    case 'decap':
      return (
        <Svg className="h-6 w-6">
          <path fill="#00c7b7" d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 2.5 5.5 3.1v6.2L12 18.5 6.5 15.3V8.6 12 5.5Z" />
          <path fill="#fff" d="M10.5 9h3v6h-3V9Z" />
        </Svg>
      )
    case 'electron':
      return (
        <Svg className="h-6 w-6">
          <circle cx="12" cy="12" r="2.2" fill="#47848f" />
          <ellipse cx="12" cy="12" rx="9.5" ry="3.5" fill="none" stroke="#47848f" strokeWidth="1.2" />
          <ellipse cx="12" cy="12" rx="9.5" ry="3.5" fill="none" stroke="#47848f" strokeWidth="1.2" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="9.5" ry="3.5" fill="none" stroke="#47848f" strokeWidth="1.2" transform="rotate(120 12 12)" />
        </Svg>
      )
    case 'prettier':
      return (
        <Svg className="h-6 w-6">
          <path fill="#56b3b4" d="M8 6h8v2H8V6Zm-2 4h12v2H6v-2Zm2 4h8v2H8v-2Z" />
          <path fill="#c596c7" d="M10 8h4v1h-4V8Zm-4 4h12v1H6v-1Zm4 4h4v1h-4v-1Z" />
        </Svg>
      )
    case 'eslint-logo':
      return (
        <Svg className="h-6 w-6">
          <path fill="#4b32c3" d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.8 3.8v7.8L12 19.7 5.2 15.9V8.1 12 4.3Z" />
          <path fill="#fff" d="M13.2 8.5 11 14.5h1.2l.5-1.4h2.6l.5 1.4H17l-2.2-6h-1.6Zm-.8 3.7.9-2.6.9 2.6h-1.8Z" />
        </Svg>
      )
    case 'vitest':
      return (
        <Svg className="h-6 w-6">
          <path fill="#729b1a" d="M12 3 4 8v8l8 5 8-5V8l-8-5Zm0 2.5L17 8v8l-5 3-5-3V8l5-2.5Z" />
          <path fill="#fff" d="M10 9h4l-1 6h-2l-1-6Z" />
        </Svg>
      )
    case 'react-router':
      return (
        <Svg className="h-6 w-6">
          <path fill="#ca4245" d="M12 3C7.6 3 4 6.6 4 11s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8Zm0 2.5c3 0 5.5 2.5 5.5 5.5S15 16.5 12 16.5 6.5 14 6.5 11 9 5.5 12 5.5Z" />
          <path fill="#fff" d="M12 8v6l4-2-4-4Z" />
        </Svg>
      )
    case 'pinia':
      return (
        <Svg className="h-6 w-6">
          <path fill="#ffd859" d="M12 4c-3.5 0-6 2.2-6 5.5 0 2.2 1.6 4.1 4 4.8V19h4v-4.7c2.4-.7 4-2.6 4-4.8C18 6.2 15.5 4 12 4Z" />
          <circle cx="12" cy="9.5" r="1.5" fill="#443c38" />
        </Svg>
      )
    case 'lucide':
      return (
        <Svg className="h-6 w-6 text-slate-200">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path fill="currentColor" d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.5" />
        </Svg>
      )
    case 'zustand':
      return (
        <Svg className="h-6 w-6">
          <path fill="#443c38" d="M6 6h12v12H6V6Z" />
          <path fill="#ea6841" d="M8 8h8v2H8V8Zm0 3h8v2H8v-2Zm0 3h5v2H8v-2Z" />
        </Svg>
      )
    case 'tanstack-query':
      return (
        <Svg className="h-6 w-6">
          <path fill="#ff4154" d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 2.5 5.5 3.1v6.2L12 18.5 6.5 15.3V8.6 12 5.5Z" />
          <path fill="#fff" d="M10.5 9.5h3v1.5h-3V9.5Zm0 3h3v1.5h-3v-1.5Z" />
        </Svg>
      )
    default:
      return null
  }
}

export function TechLogo({ id, size = 40 }: { id: TechLogoId; size?: number }) {
  const bg = brandBg[id] ?? 'bg-slate-800'
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg border border-edge ${bg}`}
      style={{ width: size, height: size }}
    >
      <LogoMark id={id} />
    </span>
  )
}

export function frameworkLogoId(framework: string): TechLogoId {
  switch (framework) {
    case 'next':
      return 'next'
    case 'vite-react':
      return 'react'
    case 'vite-vue':
      return 'vue'
    case 'vite-vanilla':
      return 'vanilla'
    case 'electron':
      return 'electron'
    default:
      return 'vite'
  }
}

export function cmsLogoId(cms: string): TechLogoId {
  if (cms === 'none') return 'cms-none'
  if (cms === 'payload') return 'payload'
  if (cms === 'strapi') return 'strapi'
  if (cms === 'decap') return 'decap'
  return 'cms-none'
}
