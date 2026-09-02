"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
/*  Collapsed mode — icon rail; hovering a group opens a flyout panel  */
/* ------------------------------------------------------------------ */

function FlyoutNode({ node, onNavigate }: { node: DashTreeNode; onNavigate: () => void }) {
  const pathname = usePathname();

  if (node.kind === "group") {
    return (
      <li className="px-1 py-1">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{node.label}</p>
        <ul className="space-y-0.5">
          {(node.children ?? []).map((child) => (
            <FlyoutNode key={child.label} node={child} onNavigate={onNavigate} />
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
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
        }`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-brand-600" : "bg-ink-300"}`} />
        <span className="truncate">{node.label}</span>
      </Link>
    </li>
  );
}

function RailItem({ node, active }: { node: DashTreeNode; active: boolean }) {
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = iconFor(node.icon);

  function open() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovered(true);
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setHovered(false), 120);
  }
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (node.kind === "leaf") {
    return (
      <li className="group relative">
        <Link href={node.href ?? "/"} aria-current={active ? "page" : undefined} className={`sidebar-rail-btn ${active ? "active" : ""}`}>
          <Icon className="h-4.5 w-4.5" />
        </Link>
        <span className="sidebar-rail-tooltip">{node.label}</span>
      </li>
    );
  }

  return (
    <li className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
      <button type="button" className={`sidebar-rail-btn ${active ? "active" : ""}`} aria-haspopup="true" aria-expanded={hovered}>
        <Icon className="h-4.5 w-4.5" />
      </button>
      {!hovered && <span className="sidebar-rail-tooltip">{node.label}</span>}

      {hovered && (
        <div className="sidebar-flyout" role="menu">
          <div className="sidebar-flyout-card">
            <p className="border-b border-ink-100 px-3 py-2 text-xs font-semibold text-ink-800">{node.label}</p>
            <ul className="max-h-[70vh] overflow-y-auto py-1.5">
              {(node.children ?? []).map((child) => (
                <FlyoutNode key={child.label} node={child} onNavigate={() => setHovered(false)} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar shell                                                     */
/* ------------------------------------------------------------------ */

export default function Sidebar({ role, name }: { role: Role; name?: string }) {
  const pathname = usePathname();

  const items = useMemo(() => filterTreeForRole(dashboardTree, role), [role]);

  const [open, setOpen] = useState<Set<string>>(() => defaultOpenGroups(items, pathname));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
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
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-ink-200 bg-white transition-[width] duration-200 ${
        collapsed ? "w-19" : "w-72"
      }`}
    >
      {/* Brand header */}
      <div className="flex h-16 items-center gap-2.5 border-b border-ink-200 px-4">
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

      {/* Navigation */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3" aria-label="Dashboard navigation">
        {collapsed ? (
          <ul className="flex flex-col items-center gap-1">
            {items.map((node) => (
              <RailItem key={nodeKey(node, null)} node={node} active={isNodeOrChildActive(node, pathname)} />
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
      <div className="border-t border-ink-200 p-2">
        {!collapsed && name && (
          <p className="truncate px-2 pb-1.5 text-xs text-ink-400">
            Signed in as <span className="font-semibold text-ink-600">{name}</span>
          </p>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <RiSidebarUnfoldLine className="h-4 w-4" /> : <RiSidebarFoldLine className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
