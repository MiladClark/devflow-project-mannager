export interface Hint {
  title: string
  useCases: string[]
  limitations: string[]
  recommendation: string
}

export const hints: Record<string, Hint> = {
  next: {
    title: 'Next.js 15',
    useCases: [
      'Production websites that need SEO (server-side rendering / static generation)',
      'Full-stack apps: API routes, server actions and frontend in one project',
      'E-commerce, marketing sites, blogs, dashboards with auth',
    ],
    limitations: [
      'Heavier tooling and slower cold builds than plain Vite',
      'SSR needs a Node server in production (or a platform like Vercel)',
      'More concepts to learn: App Router, server vs client components',
    ],
    recommendation:
      'The safe default for anything public-facing. If you are building an internal tool or pure SPA without SEO needs, Vite is lighter.',
  },
  'vite-react': {
    title: 'Vite + React',
    useCases: [
      'Single-page apps: admin panels, dashboards, internal tools',
      'Fast prototyping with instant hot-reload',
      'Frontends that talk to a separate backend/API',
    ],
    limitations: [
      'No server-side rendering out of the box — weak SEO for public content',
      'Routing, data fetching and state are your own choices to wire up',
    ],
    recommendation:
      'Best choice for SPAs and internal tools. Pair it with a Strapi or database backend from this app if you need content or data.',
  },
  'vite-vue': {
    title: 'Vite + Vue',
    useCases: [
      'SPAs with Vue 3 Composition API and single-file components',
      'Teams already invested in the Vue ecosystem (Pinia, Vue Router)',
      'Progressive enhancement of existing pages',
    ],
    limitations: [
      'Smaller ecosystem and job market than React',
      'No SSR out of the box (Nuxt covers that, not included here)',
    ],
    recommendation: 'Pick this if you or your team prefer Vue. Feature-wise it is on par with Vite + React for SPAs.',
  },
  'vite-vanilla': {
    title: 'Vite Vanilla',
    useCases: [
      'Small demos, widgets, embeds and learning projects',
      'Landing pages with minimal JavaScript',
      'Library playgrounds without framework overhead',
    ],
    limitations: [
      'No component model, routing or state management — everything is manual',
      'Grows painful beyond a few screens',
    ],
    recommendation: 'Great for experiments and tiny pages. For anything with real UI complexity, pick React or Vue.',
  },
  electron: {
    title: 'Electron + React',
    useCases: [
      'Desktop apps for Windows, macOS and Linux from one codebase',
      'Developer tools, utilities and internal apps that need native menus and file access',
      'Apps that reuse your React skills with Vite hot-reload in the renderer',
    ],
    limitations: [
      'Larger install size and memory use than a pure web app',
      'Code signing and auto-update need extra setup for production releases',
      'The scaffold includes ESLint and Prettier — add-on list skips those duplicates',
    ],
    recommendation:
      'Pick this when you need a real desktop app. DevFlow itself is built with Electron — this template uses the same electron-vite stack.',
  },
  'cms-none': {
    title: 'No CMS',
    useCases: [
      'Apps where content lives in code, a database, or an external API',
      'Projects that will get a CMS decision later',
    ],
    limitations: ['Non-technical editors cannot change content without a developer.'],
    recommendation: 'Fine for most apps. You can attach a database from the Connections page instead.',
  },
  'cms-payload': {
    title: 'Payload CMS',
    useCases: [
      'Code-first CMS living inside your Next.js app — one deploy, one repo',
      'Developer-owned schemas with a generated admin UI, auth and REST/GraphQL APIs',
      'Self-hosted projects that want full control over the stack',
    ],
    limitations: [
      'TypeScript only — the TypeScript toggle is forced on',
      'Creates its own Next.js app (framework selection is fixed to Next.js)',
      'Scaffolds with SQLite for development; switch to Postgres for production (use the Connections page)',
    ],
    recommendation:
      'Best pick when developers define the content model and you want CMS + site in a single Next.js codebase.',
  },
  'cms-strapi': {
    title: 'Strapi',
    useCases: [
      'Standalone headless CMS with a full point-and-click admin panel',
      'Content teams building collection types without code',
      'One content backend serving multiple frontends (web, mobile) via REST/GraphQL',
    ],
    limitations: [
      'It is its own Node service (default port 1337) — your frontend is a separate project',
      'The framework selection above is ignored: Strapi ships its own stack',
      'Heavier install (~500MB) and version upgrades need care',
      'Quickstart uses SQLite; move to Postgres/MySQL for production',
    ],
    recommendation:
      'Choose when non-developers manage content and the frontend is built separately. Create the frontend as a second project and point it at http://localhost:1337.',
  },
  'cms-decap': {
    title: 'Decap CMS (git-based)',
    useCases: [
      'Blogs, docs and marketing sites where content is Markdown in the repo',
      'Zero infrastructure: no database, no extra server — edits become git commits',
      'Static sites deployed on Netlify/Vercel/GitHub Pages',
    ],
    limitations: [
      'Editors need git hosting with OAuth (e.g. Netlify Identity / GitHub) configured before /admin works',
      'Not suited for large datasets, relational content or frequent programmatic writes',
      'Adds a static /admin page — your frontend must read the Markdown files itself',
    ],
    recommendation:
      'The lightest option. Ideal for content-light static sites; skip it if content is relational or high-volume.',
  },
  typescript: {
    title: 'TypeScript',
    useCases: [
      'Catching bugs at compile time instead of runtime',
      'Safe refactoring and editor autocomplete on larger codebases',
      'Teams sharing code — types are documentation',
    ],
    limitations: [
      'Slight learning curve and stricter builds',
      'Third-party libraries occasionally have poor type definitions',
    ],
    recommendation: 'Keep it on. Modern tooling assumes TypeScript; turning it off only pays for very small throwaway scripts.',
  },
  tailwind: {
    title: 'Tailwind CSS',
    useCases: [
      'Fast UI building with utility classes, no naming or separate CSS files',
      'Consistent spacing/color scales across the app',
      'Design systems and dark mode via configuration',
    ],
    limitations: [
      'Long class strings can hurt readability',
      'A short adjustment period if you are used to plain CSS/BEM',
    ],
    recommendation: 'Recommended for most projects. Disable only if your team standardizes on another styling solution.',
  },
}
