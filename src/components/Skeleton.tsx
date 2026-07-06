import type { CSSProperties, ReactNode } from 'react'

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden="true" />
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-[72%]' : 'w-full')} />
      ))}
    </div>
  )
}

export function SkeletonPageHeader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  )
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex-1 rounded-xl border border-edge bg-panel p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-4 rounded-md" />
          </div>
          <Skeleton className="mt-3 h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonProjectTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-edge">
      <div className="border-b border-edge bg-panel2 px-4 py-3">
        <div className="flex gap-6">
          {[112, 72, 56, 40, 48, 44].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-edge bg-panel px-4 py-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-52 max-w-full" />
          </div>
          <Skeleton className="hidden h-3 w-16 md:block" />
          <Skeleton className="hidden h-6 w-14 rounded-full md:block" />
          <Skeleton className="hidden h-3 w-8 lg:block" />
          <Skeleton className="hidden h-3 w-20 lg:block" />
          <div className="hidden gap-1 sm:flex">
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className="h-7 w-7 rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonToolCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-edge bg-panel p-4">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <SkeletonText lines={2} className="mt-3" />
          <Skeleton className="mt-4 h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonAccountPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="rounded-xl border border-edge bg-panel p-5">
        <Skeleton className="mb-4 h-3 w-20" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-4" style={{ width: i % 2 === 0 ? '45%' : '75%' }} />
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonRightRail() {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="mt-2 h-3 w-[80%]" />
            </div>
          </div>
        ))}
        <div className="border-t border-edge" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="mt-3 h-14 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
        </div>
      </div>
      <div className="shrink-0 border-t border-edge p-4">
        <Skeleton className="mb-3 h-3 w-24" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex justify-between py-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
        ))}
      </div>
    </>
  )
}

export function SkeletonServiceCards({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-edge bg-panel p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-3 w-full max-w-sm" />
          <Skeleton className="mt-4 h-7 w-16 rounded-md" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonEnvEditor() {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-edge bg-panel p-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-8 min-w-0 flex-1 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonGitPanel() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-edge bg-panel p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <SkeletonText lines={2} />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  )
}

export function SkeletonProcessTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-edge">
      <div className="border-b border-edge bg-panel2 px-4 py-3">
        <div className="flex gap-8">
          {[80, 64, 40, 48, 120, 48].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-edge bg-panel px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="hidden h-3 w-40 md:block" />
          <Skeleton className="h-7 w-12 rounded-md" />
        </div>
      ))}
    </div>
  )
}

/** Cross-fades from skeleton to real content when loading completes. */
export function ContentReveal({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean
  skeleton: ReactNode
  children: ReactNode
  className?: string
}) {
  if (loading) return <>{skeleton}</>
  return <div className={cn('animate-content-in', className)}>{children}</div>
}
