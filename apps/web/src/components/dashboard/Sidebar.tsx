"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useCallback, type CSSProperties } from "react";
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
/*  Recursive tree node                                              */
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

  // --- leaf -------------------------------------------------------
  if (node.kind === "leaf") {
    const active = isLeafActive(node, pathname);
    return (
      <li
        className={`tree-node${active ? " tree-leaf-active" : ""}`}
        data-last={isLast || undefined}
        data-level={level}
      >
        <Link
          href={node.href ?? "/"}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
            active
              ? "bg-navy-50 text-navy-800"
              : "text-ink-600 hover:text-navy-800"
          }`}
          style={{ paddingLeft: `${14 + level * 16}px` }}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {node.label}
        </Link>
      </li>
    );
  }

  // --- group ------------------------------------------------------
  const active = isNodeOrChildActive(node, pathname);
  const children = node.children ?? [];

  return (
    <li className="tree-node" data-last={isLast || undefined} data-level={level}>
      <button
        type="button"
        onClick={() => toggle(key, parentKey)}
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
          active
            ? "text-navy-800"
            : "text-ink-500 hover:text-navy-800"
        }`}
        style={{ paddingLeft: `${14 + level * 16}px` }}
      >
        <span className="flex items-center gap-2">
          {node.icon && <Icon className="h-3.5 w-3.5" />}
          {node.label}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      <div
        className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0">
          {children.length > 0 && (
            <ul
              className="tree-branch space-y-0.5"
              style={{ "--tx": `${14 + level * 16}px` } as CSSProperties}
              aria-label={`${node.label} submenu`}
            >
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
          )}
        </div>
      </div>
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
      // Accordion: close every sibling at the same level.
      // (Ancestors at other levels stay open so the active trail remains visible.)
      Array.from(next).forEach((k) => {
        const idx = k.lastIndexOf("/");
        const parent = idx === -1 ? null : k.slice(0, idx);
        if (parent === parentKey) next.delete(k);
      });
      if (!wasOpen) {
        next.add(key);
        // Collapse any descendants of this group so only one path is ever open.
        const prefix = `${key}/`;
        Array.from(next).forEach((k) => {
          if (k.startsWith(prefix)) next.delete(k);
        });
      }
      return next;
    });
  }, []);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-ink-200 bg-white lg:block">
      <div className="flex h-16 items-center gap-2.5 border-b border-ink-200 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-navy-800 text-white">
          <GraduationCapIcon className="h-5 w-5" />
        </span>
        <span className="font-display text-sm font-extrabold leading-tight text-navy-900">
          MHS Dashboard
        </span>
      </div>

      <nav className="p-3" aria-label="Dashboard navigation">
        <ul className="space-y-0.5">
          {items.map((node) => (
            <TreeNode
              key={nodeKey(node, null)}
              node={node}
              parentKey={null}
              level={0}
              open={open}
              toggle={toggle}
            />
          ))}
        </ul>
      </nav>

      <div className="mt-auto border-t border-ink-200 p-4">
        <p className="text-xs text-ink-400">Signed in as</p>
        <p className="text-sm font-semibold text-navy-800">
          {name ?? roleLabels[role]}
        </p>
        <p className="text-[11px] text-ink-500">{roleLabels[role]}</p>
      </div>
    </aside>
  );
}
