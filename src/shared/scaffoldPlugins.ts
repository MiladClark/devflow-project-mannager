import type { CmsChoice, ScaffoldOptions, ScaffoldPluginId } from './types'

export type { ScaffoldPluginId }

export interface ScaffoldPluginDef {
  id: ScaffoldPluginId
  name: string
  description: string
  logo: Exclude<ScaffoldPluginId, 'eslint'> | 'eslint-logo'
}

export const SCAFFOLD_PLUGINS: Record<ScaffoldPluginId, ScaffoldPluginDef> = {
  prettier: {
    id: 'prettier',
    name: 'Prettier',
    description: 'Consistent code formatting with a single command',
    logo: 'prettier',
  },
  eslint: {
    id: 'eslint',
    name: 'ESLint',
    description: 'Catch bugs and style issues while you code',
    logo: 'eslint-logo',
  },
  vitest: {
    id: 'vitest',
    name: 'Vitest',
    description: 'Fast unit tests with a Vite-native runner',
    logo: 'vitest',
  },
  'react-router': {
    id: 'react-router',
    name: 'React Router',
    description: 'Client-side routing for React SPAs',
    logo: 'react-router',
  },
  pinia: {
    id: 'pinia',
    name: 'Pinia',
    description: 'Official state management for Vue 3',
    logo: 'pinia',
  },
  lucide: {
    id: 'lucide',
    name: 'Lucide Icons',
    description: 'Beautiful open-source icon set for your UI',
    logo: 'lucide',
  },
  zustand: {
    id: 'zustand',
    name: 'Zustand',
    description: 'Minimal global state for React apps',
    logo: 'zustand',
  },
  'tanstack-query': {
    id: 'tanstack-query',
    name: 'TanStack Query',
    description: 'Server-state caching, fetching and sync for React',
    logo: 'tanstack-query',
  },
}

export function availablePlugins(opts: Pick<ScaffoldOptions, 'framework' | 'cms'>): ScaffoldPluginId[] {
  if (opts.cms === 'payload' || opts.cms === 'strapi') {
    return ['prettier']
  }

  const base: ScaffoldPluginId[] = ['prettier', 'vitest']

  if (opts.framework === 'next') {
    return [...base, 'lucide', 'zustand', 'tanstack-query']
  }
  if (opts.framework === 'electron') {
    return ['vitest', 'react-router', 'lucide', 'zustand', 'tanstack-query']
  }
  if (opts.framework === 'vite-react') {
    return [...base, 'eslint', 'react-router', 'lucide', 'zustand', 'tanstack-query']
  }
  if (opts.framework === 'vite-vue') {
    return [...base, 'eslint', 'pinia', 'lucide']
  }
  return [...base, 'eslint']
}

export function normalizePlugins(
  selected: ScaffoldPluginId[],
  opts: Pick<ScaffoldOptions, 'framework' | 'cms'>,
): ScaffoldPluginId[] {
  const allowed = new Set(availablePlugins(opts))
  return selected.filter((id) => allowed.has(id))
}
