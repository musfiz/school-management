"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import {
  dashboardTree,
  filterTreeForRole,
  defaultOpenGroups,
  isNodeOrChildActive,
  nodeKey,
  type DashTreeNode,
  type Role,
} from "@/lib/dashboard-nav";
import {
  BookIcon,
  CalendarIcon,
  CalendarSmallIcon,
  GraduationCapIcon,
  MailIcon,
  PinIcon,
  SettingsIcon,
  UsersIcon,
  BookSmallIcon,
  GlobeIcon,
  SparkIcon,
  FlaskIcon,
  PaletteIcon,
  ArrowDownIcon,
} from "@/components/icons";
import { roleLabels } from "@/lib/dashboard-nav";

const iconMap = {
  home: GraduationCapIcon,
  users: UsersIcon,
  teacher: BookIcon,
  result: CalendarIcon,
  notice: MailIcon,
  profile: PinIcon,
  settings: SettingsIcon,
  calendar: CalendarSmallIcon,
  book: BookSmallIcon,
  info: GlobeIcon,
  admission: GraduationCapIcon,
  student: UsersIcon,
  facilities: SparkIcon,
  others: GlobeIcon,
  about: GlobeIcon,
  library: BookIcon,
  lab: FlaskIcon,
  fees: CalendarIcon,
  exam: CalendarIcon,
  gallery: PaletteIcon,
  download: ArrowDownIcon,
} as const;

function iconFor(name: string) {
  return iconMap[name as keyof typeof iconMap];
}

function isLeafActive(leaf: DashTreeNode, pathname: string): boolean {
  if (!leaf.href) return false;
  return leaf.href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(leaf.href);
}

/* ------------------------------------------------------------------ */
/*  Compact tree node with proper hierarchy                           */
/* ------------------------------------------------------------------ */

function TreeNode({
  node,
  parentKey,
  level,
  open,
  toggle,
  isLast = false,
}: {
  node: DashTreeNode;
  parentKey: string | null;
  level: number;
  open: Set<string>;
  toggle: (key: string, parentKey: string | null) => void;
  isLast?: boolean;
}) {
  const pathname = usePathname();
  const key = nodeKey(node, parentKey);
  const isOpen = open.has(key);
  const Icon = iconFor(node.icon ?? "home");
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
          <span className="flex items-center gap-2.5">
            <Icon className="h-4 w-4 shrink-0 opacity-70" />
            <span className="flex-1 text-left">{node.label}</span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>

        <div className={`sidebar-children ${isOpen ? "open" : ""}`}>
          <ul className="sidebar-children-list">
            {children.map((child, i) => (
              <TreeNode
                key={nodeKey(child, key)}
                node={child}
                parentKey={key}
                level={level + 1}
                open={open}
                toggle={toggle}
                isLast={i === children.length - 1}
              />
            ))}
          </ul>
        </div>
      </li>
    );
  }

  // Leaf node (actual link)
  const active = isLeafActive(node, pathname);

  return (
    <li className="sidebar-leaf" data-level={level}>
      <Link
        href={node.href ?? "/"}
        aria-current={active ? "page" : undefined}
        className={`sidebar-leaf-link ${active ? "active" : ""}`}
      >
        <span className="flex items-center gap-2.5">
          <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
          <span>{node.label}</span>
        </span>
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar shell                                                    */
/* ------------------------------------------------------------------ */

export default function Sidebar({
  role,
  name,
}: {
  role: Role;
  name?: string;
}) {
  const pathname = usePathname();

  const items = useMemo(() => filterTreeForRole(dashboardTree, role), [role]);

  const [open, setOpen] = useState<Set<string>>(() =>
    defaultOpenGroups(items, pathname),
  );

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
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-indigo-600 text-white">
          <GraduationCapIcon className="h-4 w-4" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-900">MHS</span>
          <span className="text-[10px] text-slate-500">Dashboard</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3" aria-label="Dashboard navigation">
        <ul className="sidebar-nav">
          {items.map((node, i) => (
            <TreeNode
              key={nodeKey(node, null)}
              node={node}
              parentKey={null}
              level={0}
              open={open}
              toggle={toggle}
              isLast={i === items.length - 1}
            />
          ))}
        </ul>
      </nav>

      {/* User info footer */}
      <div className="border-t border-slate-200 p-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Signed in as</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">{name ?? roleLabels[role]}</p>
        <p className="text-xs text-slate-500">{roleLabels[role]}</p>
      </div>
    </aside>
  );
}
