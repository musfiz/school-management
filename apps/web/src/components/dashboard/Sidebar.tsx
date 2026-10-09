"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  dashboardTree,
  filterTreeForRole,
  defaultOpenGroups,
  isNodeOrChildActive,
  nodeKey,
  roleLabels,
  type DashTreeNode,
  type Role,
} from "@/lib/dashboard-nav";
import { RiGraduationCapLine, RiArrowDownSLine, RiSidebarFoldLine, RiSidebarUnfoldLine } from "react-icons/ri";
import type { IconType } from "react-icons";

function iconFor(icon: IconType | undefined): IconType {
  return icon ?? RiGraduationCapLine;
}

function isLeafActive(leaf: DashTreeNode, pathname: string): boolean {
  if (!leaf.href) return false;
  return leaf.href === "/admin" ? pathname === "/admin" : pathname.startsWith(leaf.href);
}

const COLLAPSE_STORAGE_KEY = "dashboard:sidebar-collapsed";

/** Gap between the icon rail and its portalled overlay. */
const RAIL_GAP = 10;
/** Viewport padding kept around portalled overlays so nothing hugs an edge. */
const OVERLAY_PAD = 12;
/** Rail flyout card bounds. */
const RAIL_CARD_MIN = 232;
const RAIL_CARD_MAX = 292;
/** Hover delay before a rail label tooltip appears, so passing the cursor
 *  over the rail doesn't strobe a tooltip per icon. */
const TOOLTIP_DELAY = 260;

/* ------------------------------------------------------------------ */
/*  Portal helper — overlays render on <body> so the nav's overflow    */
/*  can never clip them                                               */
/* ------------------------------------------------------------------ */

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Keeps a portalled overlay glued to its anchor while the page scrolls or
 * resizes. Listening on `scroll` in the capture phase catches scrolling in any
 * ancestor, which a plain bubble-phase listener on `window` would miss.
 */
function useAnchoredPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  measure: (anchor: DOMRect, panel: DOMRect) => { top: number; left: number },
): { style: React.CSSProperties; ready: boolean } {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setPos(null);
      return;
    }

    function place() {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      setPos(measure(anchor.getBoundingClientRect(), panel.getBoundingClientRect()));
    }

    place();
    // Second pass after the browser has laid the panel out at its natural
    // size — the first pass can measure a not-yet-sized element.
    const raf = requestAnimationFrame(place);

    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [active, anchorRef, panelRef, measure]);

  // Hidden until measured, so an overlay never flashes at 0,0.
  return {
    style: pos
      ? { top: `${pos.top}px`, left: `${pos.left}px`, visibility: "visible" }
      : { top: "0px", left: "0px", visibility: "hidden" },
    ready: pos !== null,
  };
}

/* ------------------------------------------------------------------ */
/*  Expanded mode — inline accordion tree                             */
/* ------------------------------------------------------------------ */

function TreeNode({
  node,
  parentKey,
  level,
  open,
  toggle,
}: {
  node: DashTreeNode;
  parentKey: string | null;
  level: number;
  open: Set<string>;
  toggle: (key: string, parentKey: string | null) => void;
}) {
  const pathname = usePathname();
  const key = nodeKey(node, parentKey);
  const isOpen = open.has(key);
  const Icon = iconFor(node.icon);
  const isGroup = node.kind === "group";

  // Group header (collapsible section)
  if (isGroup) {
    const active = isNodeOrChildActive(node, pathname);
    const children = node.children ?? [];

    return (
      <li className="sidebar-group" data-level={level}>
        <button
          type="button"
          onClick={() => toggle(key, parentKey)}
          aria-expanded={isOpen}
          className={`sidebar-group-btn ${active ? "active" : ""}`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="sidebar-icon-chip">
              <Icon className="h-4 w-4 shrink-0" />
            </span>
            <span className="flex-1 truncate text-left">{node.label}</span>
          </span>
          <RiArrowDownSLine
            className={`h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform duration-200 ${
              isOpen ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>

        <div className={`sidebar-children ${isOpen ? "open" : ""}`}>
          <ul className="sidebar-children-list">
            {children.map((child) => (
              <TreeNode key={nodeKey(child, key)} node={child} parentKey={key} level={level + 1} open={open} toggle={toggle} />
            ))}
          </ul>
        </div>
      </li>
    );
  }

  // Leaf node (actual link)
  const active = isLeafActive(node, pathname);
  const LeafIcon = iconFor(node.icon);

  return (
    <li className="sidebar-leaf" data-level={level}>
      <Link href={node.href ?? "/"} aria-current={active ? "page" : undefined} className={`sidebar-leaf-link ${active ? "active" : ""}`}>
        <span className="sidebar-icon-chip">
          <LeafIcon className="h-4 w-4 shrink-0" />
        </span>
        <span className="truncate">{node.label}</span>
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsed mode — icon rail                                         */
/* ------------------------------------------------------------------ */

function tooltipPosition(anchor: DOMRect, panel: DOMRect) {
  const top = Math.min(
    Math.max(anchor.top + anchor.height / 2, OVERLAY_PAD + 12),
    window.innerHeight - OVERLAY_PAD - 12,
  );
  // Clamp horizontally so a long label never hangs off a narrow viewport.
  const left = Math.min(anchor.right + RAIL_GAP, window.innerWidth - panel.width - OVERLAY_PAD);
  return { top, left: Math.max(OVERLAY_PAD, left) };
}

function flyoutPosition(anchor: DOMRect, panel: DOMRect) {
  // The rail is pinned to the left edge, so the card always opens rightward;
  // clamp instead of flipping to keep the pointer-gap bridge on the correct side.
  const left = Math.max(OVERLAY_PAD, Math.min(anchor.right + RAIL_GAP, window.innerWidth - panel.width - OVERLAY_PAD));

  // Keep the whole card on screen instead of letting it run off the bottom.
  const top = Math.min(
    Math.max(anchor.top - 8, OVERLAY_PAD),
    Math.max(OVERLAY_PAD, window.innerHeight - panel.height - OVERLAY_PAD),
  );

  return { top, left };
}

/** Portalled label bubble for a rail icon. Hidden from pointer events. */
function RailTooltip({ label, anchorRef, show }: { label: string; anchorRef: React.RefObject<HTMLElement | null>; show: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { style, ready } = useAnchoredPosition(anchorRef, panelRef, show, tooltipPosition);

  if (!show) return null;

  return createPortal(
    <div ref={panelRef} className={`sidebar-rail-tooltip ${ready ? "ready" : ""}`} style={style} role="tooltip">
      {label}
    </div>,
    document.body,
  );
}

function FlyoutNode({ node, onNavigate }: { node: DashTreeNode; onNavigate: () => void }) {
  const pathname = usePathname();

  if (node.kind === "group") {
    return (
      <li className="px-1 py-1">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{node.label}</p>
        <ul className="space-y-0.5">
          {(node.children ?? []).map((child) => (
            <FlyoutNode key={nodeKey(child, node.label.toLowerCase().replace(/\s+/g, "-"))} node={child} onNavigate={onNavigate} />
          ))}
        </ul>
      </li>
    );
  }

  const active = isLeafActive(node, pathname);
  return (
    <li>
      <Link
        href={node.href ?? "/"}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`sidebar-flyout-link ${active ? "active" : ""}`}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" aria-hidden />
        <span className="truncate">{node.label}</span>
      </Link>
    </li>
  );
}

/** Portalled submenu for a rail group. Bridges the rail→card gap with a
 *  transparent padding box so the pointer never crosses a dead zone. */
function RailFlyout({
  node,
  anchorRef,
  panelRef,
  onEnter,
  onLeave,
  onNavigate,
}: {
  node: DashTreeNode;
  anchorRef: React.RefObject<HTMLElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  onNavigate: () => void;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const { style, ready } = useAnchoredPosition(anchorRef, localRef, true, flyoutPosition);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = Array.from(localRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []);
    if (links.length === 0) return;
    e.preventDefault();
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = e.key === "ArrowDown" ? (current + 1) % links.length : (current - 1 + links.length) % links.length;
    links[next]?.focus();
  }

  return createPortal(
    <div
      ref={panelRef}
      className="sidebar-flyout"
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onKeyDown={onKeyDown}
    >
      <div
        ref={localRef}
        className={`sidebar-flyout-card ${ready ? "ready" : ""}`}
        style={{ minWidth: RAIL_CARD_MIN, maxWidth: RAIL_CARD_MAX }}
        role="menu"
        aria-label={node.label}
      >
        <p className="border-b border-ink-100 px-3 py-2 text-xs font-semibold text-ink-800">{node.label}</p>
        <ul className="scroll-slim sidebar-flyout-scroll py-1.5" style={{ maxHeight: `calc(100vh - ${OVERLAY_PAD * 2}px)` }}>
          {(node.children ?? []).map((child) => (
            <FlyoutNode key={nodeKey(child, node.label.toLowerCase().replace(/\s+/g, "-"))} node={child} onNavigate={onNavigate} />
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

function RailItem({
  node,
  active,
  openKey,
  setOpenKey,
}: {
  node: DashTreeNode;
  active: boolean;
  /** Key of the single rail item allowed to show a flyout right now. */
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
}) {
  const pathname = usePathname();
  const anchorRef = useRef<HTMLElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinned, setPinned] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const key = nodeKey(node, null);
  const Icon = iconFor(node.icon);
  const isGroup = node.kind === "group";
  const open = isGroup && openKey === key;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setPinned(false);
      setOpenKey(null);
    }, 160);
  }, [cancelClose, setOpenKey]);

  const showTooltip = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltip(true), TOOLTIP_DELAY);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(false);
  }, []);

  useEffect(
    () => () => {
      cancelClose();
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    },
    [cancelClose],
  );

  // Navigating closes the flyout; leaving it pinned would strand it on screen.
  useEffect(() => {
    setPinned(false);
    setOpenKey(null);
    hideTooltip();
  }, [pathname, hideTooltip, setOpenKey]);

  // A click-pinned flyout must still be dismissible without re-hovering the
  // rail: Esc anywhere, or a pointer-down outside the trigger and the panel.
  useEffect(() => {
    if (!pinned) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as globalThis.Node;
      if (anchorRef.current?.contains(target) || flyoutRef.current?.contains(target)) return;
      setPinned(false);
      setOpenKey(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setPinned(false);
      setOpenKey(null);
      hideTooltip();
      anchorRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned, hideTooltip, setOpenKey]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!isGroup) return;
    if (e.key === "Escape") {
      setPinned(false);
      setOpenKey(null);
      return;
    }
    if (e.key === "ArrowRight" || (e.key === "Enter" && !pinned) || (e.key === " " && !pinned)) {
      e.preventDefault();
      cancelClose();
      setPinned(true);
      setOpenKey(key);
    }
  }

  const railBtn = <Icon className="h-4.5 w-4.5" aria-hidden />;

  if (!isGroup) {
    return (
      <li
        className="relative"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        <Link
          ref={anchorRef as React.RefObject<HTMLAnchorElement>}
          href={node.href ?? "/"}
          aria-current={active ? "page" : undefined}
          aria-label={node.label}
          className={`sidebar-rail-btn ${active ? "active" : ""}`}
        >
          {railBtn}
        </Link>
        <RailTooltip label={node.label} anchorRef={anchorRef} show={tooltip} />
      </li>
    );
  }

  return (
    <li
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        hideTooltip();
        setOpenKey(key);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={anchorRef as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={() => {
          cancelClose();
          if (open) {
            setPinned(false);
            setOpenKey(null);
          } else {
            setPinned(true);
            setOpenKey(key);
          }
        }}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onKeyDown={onKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={node.label}
        className={`sidebar-rail-btn ${active ? "active" : ""} ${open ? "open" : ""}`}
      >
        {railBtn}
      </button>
      <RailTooltip label={node.label} anchorRef={anchorRef} show={tooltip && !open} />
      {open && (
        <RailFlyout
          node={node}
          anchorRef={anchorRef}
          panelRef={flyoutRef}
          onEnter={() => {
            cancelClose();
            setOpenKey(key);
          }}
          onLeave={scheduleClose}
          onNavigate={() => {
            setPinned(false);
            setOpenKey(null);
          }}
        />
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar shell                                                     */
/* ------------------------------------------------------------------ */

export default function Sidebar({ role, name }: { role: Role; name?: string }) {
  const pathname = usePathname();
  const mounted = useMounted();

  const items = useMemo(() => filterTreeForRole(dashboardTree, role), [role]);

  const [open, setOpen] = useState<Set<string>>(() => defaultOpenGroups(items, pathname));
  const [collapsed, setCollapsed] = useState(false);
  // Key of the rail item whose flyout is open. Lifted here so sliding the
  // pointer across the rail swaps panels instead of stacking them.
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    // Leaving the rail mode must not strand a flyout over the expanded nav.
    setOpenKey(null);
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const toggle = useCallback((key: string, parentKey: string | null) => {
    setOpen((prev) => {
      const wasOpen = prev.has(key);
      const next = new Set(prev);

      // Accordion: close siblings at the same level
      Array.from(next).forEach((k) => {
        const idx = k.lastIndexOf("/");
        const parent = idx === -1 ? null : k.slice(0, idx);
        if (parent === parentKey) next.delete(k);
      });

      if (!wasOpen) {
        next.add(key);
        // Collapse descendants
        const prefix = `${key}/`;
        Array.from(next).forEach((k) => {
          if (k.startsWith(prefix)) next.delete(k);
        });
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={`dashboard-sidebar sticky top-0 flex h-screen shrink-0 flex-col border-r border-ink-200 bg-white ${
        // Suppress the width transition until the stored preference has been
        // read, otherwise a collapsed user watches the rail slide in on load.
        mounted ? "transition-[width] duration-200 ease-out" : ""
      } ${collapsed ? "w-19" : "w-72"}`}
    >
      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-ink-200 px-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-gold-400 shadow-sm">
          <RiGraduationCapLine className="h-4.5 w-4.5" />
        </span>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold text-ink-900">Model High School</span>
            <span className="truncate text-[11px] font-medium text-ink-400">{roleLabels[role]} dashboard</span>
          </div>
        )}
      </div>

      {/* Navigation. Collapsed mode hides the scrollbar outright — the rail is
          a short icon column and every group reaches its submenu through a
          flyout, so a permanent scroll gutter only steals width. */}
      <nav
        className={`${collapsed ? "sidebar-scroll-none" : "scroll-slim"} flex-1 overflow-y-auto px-3 py-3`}
        aria-label="Dashboard navigation"
      >
        {collapsed ? (
          <ul className="sidebar-rail">
            {items.map((node) => (
              <RailItem
              key={nodeKey(node, null)}
              node={node}
              active={isNodeOrChildActive(node, pathname)}
              openKey={openKey}
              setOpenKey={setOpenKey}
            />
            ))}
          </ul>
        ) : (
          <ul className="sidebar-nav">
            {items.map((node) => (
              <TreeNode key={nodeKey(node, null)} node={node} parentKey={null} level={0} open={open} toggle={toggle} />
            ))}
          </ul>
        )}
      </nav>

      {/* Signed-in user + collapse toggle */}
      <div className="shrink-0 border-t border-ink-200 p-2">
        {!collapsed && name && (
          <p className="truncate px-2 pb-1.5 text-xs text-ink-400">
            Signed in as <span className="font-semibold text-ink-600">{name}</span>
          </p>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="sidebar-collapse-btn"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <RiSidebarUnfoldLine className="h-4 w-4" /> : <RiSidebarFoldLine className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}