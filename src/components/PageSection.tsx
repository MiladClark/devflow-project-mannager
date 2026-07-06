export function PageSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-edge bg-panel p-5 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-edge pb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase">{title}</h3>
          {description && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>}
        </div>
        {action}
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

export function PageSubsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h4>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function PageDivider() {
  return <div className="border-t border-edge" role="separator" />
}
