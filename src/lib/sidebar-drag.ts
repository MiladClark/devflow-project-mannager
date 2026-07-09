/** Snapshot of section geometry before transforms are applied. */
export type SectionLayout = {
  tops: number[]
  heights: number[]
}

/** Measure block heights for live reorder preview. */
export function measureSectionHeights(sections: HTMLElement[]): number[] {
  return sections.map((el) => el.getBoundingClientRect().height)
}

/** Capture tops/heights once at drag start (untransformed layout). */
export function measureSectionLayout(sections: HTMLElement[]): SectionLayout {
  const tops: number[] = []
  const heights: number[] = []
  for (const el of sections) {
    const rect = el.getBoundingClientRect()
    tops.push(rect.top)
    heights.push(rect.height)
  }
  return { tops, heights }
}

/**
 * Insert-before index in the original list (0..n).
 * Uses frozen layout so sibling translateY previews cannot skew hit-testing.
 */
export function computeDropIndexFromLayout(
  clientY: number,
  layout: SectionLayout,
  fromIndex: number,
): number {
  const { tops, heights } = layout
  const n = tops.length
  if (n === 0) return 0

  for (let i = 0; i < n; i++) {
    if (i === fromIndex) continue
    const mid = tops[i] + heights[i] / 2
    if (clientY < mid) return i
  }
  return n
}

/**
 * Vertical shift (px) for a section at `index` while dragging from `fromIndex`
 * toward insert slot `dropIndex`. Non-dragged items slide by `dragHeight`.
 *
 * `dropIndex` is insert-before in the original list (0..n).
 */
export function computeSectionShift(
  index: number,
  fromIndex: number,
  dropIndex: number,
  dragHeight: number,
): number {
  if (dragHeight <= 0) return 0
  if (index === fromIndex) return 0
  // Same slot or immediately after self → no visual reorder
  if (dropIndex === fromIndex || dropIndex === fromIndex + 1) return 0

  if (fromIndex < dropIndex) {
    if (index > fromIndex && index < dropIndex) return -dragHeight
  } else if (fromIndex > dropIndex) {
    if (index >= dropIndex && index < fromIndex) return dragHeight
  }
  return 0
}

/** Build id → translateY map for all groups during drag preview. */
export function computeSectionShifts(
  groupIds: string[],
  fromIndex: number,
  dropIndex: number,
  dragHeight: number,
): Record<string, number> {
  const shifts: Record<string, number> = {}
  for (let i = 0; i < groupIds.length; i++) {
    shifts[groupIds[i]] = computeSectionShift(i, fromIndex, dropIndex, dragHeight)
  }
  return shifts
}

/**
 * Commit reorder. `dropIndex` is insert-before in the original list.
 * After removing `fromIndex`, the insert index must be adjusted when moving down.
 */
export function reorderByDropIndex<T>(items: T[], fromIndex: number, dropIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= items.length) return items
  if (dropIndex === fromIndex || dropIndex === fromIndex + 1) return items

  let insertAt = dropIndex
  if (dropIndex > fromIndex) insertAt = dropIndex - 1
  if (insertAt === fromIndex) return items

  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(insertAt, 0, moved)
  return next
}
