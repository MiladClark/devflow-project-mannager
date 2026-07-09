import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { GripVertical, Pin } from 'lucide-react'
import type { NavGroup } from '../lib/nav'
import { useGuestLock } from '../lib/guest'
import { getSidebarPinned, setSidebarPinned } from '../lib/sidebar'
import {
  computeDropIndexFromLayout,
  computeSectionShifts,
  measureSectionLayout,
  reorderByDropIndex,
  type SectionLayout,
} from '../lib/sidebar-drag'
import { getOrderedNavGroups, setNavGroupOrder } from '../lib/sidebar-nav-order'
import { SidebarUserCard } from './SidebarUserCard'

const SIDEBAR_CLOSE_DELAY_MS = 250
const DRAG_THRESHOLD_PX = 8

function sidebarGroupStyle(index: number): CSSProperties {
  return { '--sidebar-group-i': index } as CSSProperties
}

function sidebarItemStyle(index: number): CSSProperties {
  return { '--sidebar-item-i': index } as CSSProperties
}

type DragSession = {
  active: boolean
  dragging: boolean
  groupId: string
  fromIndex: number
  startY: number
  pointerId: number
  dragHeight: number
  layout: SectionLayout | null
  dropIndex: number
}

export function Sidebar() {
  const { guardGuest } = useGuestLock()
  const [pinned, setPinned] = useState(getSidebarPinned)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [groups, setGroups] = useState(getOrderedNavGroups)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [sectionShifts, setSectionShifts] = useState<Record<string, number>>({})

  const pointerInside = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDragging = useRef(false)
  const dragSession = useRef<DragSession>({
    active: false,
    dragging: false,
    groupId: '',
    fromIndex: -1,
    startY: 0,
    pointerId: -1,
    dragHeight: 0,
    layout: null,
    dropIndex: -1,
  })
  const sectionRefs = useRef(new Map<string, HTMLElement>())

  const expanded = pinned || hoverOpen
  const footerItemIndex = groups.reduce((n, g) => n + g.pages.length, 0)

  let itemIndex = 0

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    if (pinned || isDragging.current) return
    closeTimer.current = setTimeout(() => {
      setHoverOpen(false)
      closeTimer.current = null
    }, SIDEBAR_CLOSE_DELAY_MS)
  }, [pinned])

  const getSectionElements = useCallback(() => {
    return groups
      .map((g) => sectionRefs.current.get(g.id))
      .filter((el): el is HTMLElement => el != null)
  }, [groups])

  const updateShifts = useCallback(
    (fromIndex: number, drop: number, dragHeight: number) => {
      const ids = groups.map((g) => g.id)
      setSectionShifts(computeSectionShifts(ids, fromIndex, drop, dragHeight))
    },
    [groups],
  )

  const resetDragVisuals = useCallback(() => {
    setDragId(null)
    setDragOffsetY(0)
    setSectionShifts({})
  }, [])

  const finishDrag = useCallback(
    (dropAt: number | null) => {
      const session = dragSession.current
      if (session.dragging && dropAt != null) {
        const fromIndex = groups.findIndex((g) => g.id === session.groupId)
        if (fromIndex !== -1) {
          const next = reorderByDropIndex(groups, fromIndex, dropAt)
          if (next !== groups) {
            setGroups(next)
            setNavGroupOrder(next.map((g) => g.id))
          }
        }
      }

      session.active = false
      session.dragging = false
      session.layout = null
      session.dropIndex = -1
      isDragging.current = false
      resetDragVisuals()
    },
    [groups, resetDragVisuals],
  )

  const resolveDropIndex = (clientY: number, session: DragSession): number => {
    if (!session.layout) return session.fromIndex
    return computeDropIndexFromLayout(clientY, session.layout, session.fromIndex)
  }

  const onTitlePointerDown = (e: ReactPointerEvent<HTMLElement>, groupId: string) => {
    if (!expanded || e.button !== 0) return
    const fromIndex = groups.findIndex((g) => g.id === groupId)
    if (fromIndex === -1) return
    dragSession.current = {
      active: true,
      dragging: false,
      groupId,
      fromIndex,
      startY: e.clientY,
      pointerId: e.pointerId,
      dragHeight: 0,
      layout: null,
      dropIndex: fromIndex,
    }
  }

  const onTitlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current
    if (!session.active || e.pointerId !== session.pointerId) return

    if (!session.dragging && Math.abs(e.clientY - session.startY) > DRAG_THRESHOLD_PX) {
      const sections = getSectionElements()
      // Snapshot BEFORE any translateY preview so hit-testing stays stable
      const layout = measureSectionLayout(sections)
      const dragHeight = layout.heights[session.fromIndex] ?? 0
      session.dragging = true
      session.dragHeight = dragHeight
      session.layout = layout
      session.dropIndex = session.fromIndex
      isDragging.current = true
      setDragId(session.groupId)
      clearCloseTimer()
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    if (session.dragging && session.layout) {
      e.preventDefault()
      const offsetY = e.clientY - session.startY
      setDragOffsetY(offsetY)
      const drop = resolveDropIndex(e.clientY, session)
      session.dropIndex = drop
      updateShifts(session.fromIndex, drop, session.dragHeight)
    }
  }

  const onTitlePointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current
    if (!session.active || e.pointerId !== session.pointerId) return

    const finalDrop = session.dragging
      ? (session.layout ? resolveDropIndex(e.clientY, session) : session.dropIndex)
      : null
    finishDrag(finalDrop)

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const onTitlePointerCancel = (e: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current
    if (!session.active || e.pointerId !== session.pointerId) return
    finishDrag(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  useEffect(() => {
    setSidebarPinned(pinned)
    if (pinned) {
      clearCloseTimer()
    } else if (!pointerInside.current) {
      scheduleClose()
    }
  }, [pinned, scheduleClose])

  useEffect(() => () => clearCloseTimer(), [])

  const pinButton = (
    <button
      type="button"
      className={`app-sidebar-rail-btn app-sidebar-pin-btn${pinned ? ' app-sidebar-rail-btn-active' : ''}`}
      title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
      aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
      aria-pressed={pinned}
      onClick={() => setPinned((p) => !p)}
    >
      <Pin size={15} strokeWidth={1.75} />
    </button>
  )

  return (
    <aside
      className={`app-sidebar group/sidebar${expanded ? ' app-sidebar-expanded' : ''}${pinned ? ' app-sidebar-pinned' : ''}${dragId ? ' app-sidebar-reordering' : ''}`}
      onMouseEnter={() => {
        pointerInside.current = true
        clearCloseTimer()
        setHoverOpen(true)
      }}
      onMouseLeave={() => {
        pointerInside.current = false
        if (!isDragging.current) scheduleClose()
      }}
    >
      <nav className="app-sidebar-nav" aria-label="Main navigation">
        {groups.map((group, gi) => {
          const isDragged = dragId === group.id
          const shiftY = isDragged ? dragOffsetY : (sectionShifts[group.id] ?? 0)
          const sectionStyle: CSSProperties = {
            ...sidebarGroupStyle(gi),
            transform: shiftY !== 0 ? `translateY(${shiftY}px)` : undefined,
          }

          return (
            <section
              key={group.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(group.id, el)
                else sectionRefs.current.delete(group.id)
              }}
              className={`app-sidebar-section${isDragged ? ' app-sidebar-section-dragging' : ''}`}
              style={sectionStyle}
            >
              {gi > 0 && <hr className="app-sidebar-divider app-sidebar-anim-item" style={sidebarGroupStyle(gi)} />}
              <p
                className="app-sidebar-group-title app-sidebar-anim-item"
                style={sidebarGroupStyle(gi)}
                onPointerDown={(e) => onTitlePointerDown(e, group.id)}
                onPointerMove={onTitlePointerMove}
                onPointerUp={onTitlePointerUp}
                onPointerCancel={onTitlePointerCancel}
              >
                <GripVertical size={12} className="app-sidebar-drag-hint" aria-hidden />
                {group.title}
              </p>
              <ul className="app-sidebar-links">
                {group.pages.map(({ to, label, icon: Icon }) => {
                  const linkIndex = itemIndex++
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={to === '/'}
                        title={label}
                        onClick={(e) => {
                          if (to !== '/' && guardGuest(e)) return
                        }}
                        className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                      >
                        <Icon size={18} className="shrink-0" strokeWidth={1.75} />
                        <span
                          className="app-sidebar-label app-sidebar-anim-item"
                          style={sidebarItemStyle(linkIndex)}
                        >
                          {label}
                        </span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </nav>

      <div className="app-sidebar-bottom">
        <div className={`app-sidebar-profile${expanded ? '' : ' app-sidebar-profile-rail'}`}>
          <SidebarUserCard expanded={expanded} onHoverStart={clearCloseTimer} />
        </div>
        <div className={`app-sidebar-footer${expanded ? '' : ' app-sidebar-footer-rail'}`}>
          {expanded ? (
            <div className="app-sidebar-pin-row">
              <span
                className="app-sidebar-label app-sidebar-pin-label app-sidebar-anim-item"
                style={sidebarItemStyle(footerItemIndex)}
              >
                Pin sidebar
              </span>
              {pinButton}
            </div>
          ) : (
            pinButton
          )}
        </div>
      </div>
    </aside>
  )
}
