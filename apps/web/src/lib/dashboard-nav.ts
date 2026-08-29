/* ----------------------------------------------------------------------------
   Dashboard role model & navigation.
   Single source of truth for the protected area: who can see what.
   Wired to the mock role-gate today; swap RoleProvider for a real session
   later and this file stays the same.
---------------------------------------------------------------------------- */

export type Role = "admin" | "management" | "teacher" | "student" | "guardian";

export const ROLES: Role[] = [
  "admin",
  "management",
  "teacher",
  "student",
  "guardian",
];

export const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  management: "Management",
  teacher: "Teacher",
  student: "Student",
  guardian: "Guardian",
};

export const roleDescriptions: Record<Role, string> = {
  admin: "Full control over the school portal, users and settings.",
  management: "Oversee academics, staff and institutional reporting.",
  teacher: "Manage classes, students, attendance and results.",
  student: "View your profile, results, routine and notices.",
  guardian: "Track your child's progress, fees and notices.",
};

export type DashIconName =
  | "home"
  | "users"
  | "teacher"
  | "result"
  | "notice"
  | "profile"
  | "settings"
  | "calendar"
  | "book";

/** A leaf nav item: a real link. */
export interface DashLeaf {
  kind: "leaf";
  label: string;
  href: string;
  /** Which roles can see this leaf. */
  roles: Role[];
  icon: DashIconName;
}

/** A node inside a treeview — either a real link or a collapsible group. */
export interface DashTreeNode {
  kind: "leaf" | "group";
  label: string;
  href?: string;
  /** Which roles can see this node (leaves only; groups inherit from children). */
  roles?: Role[];
  icon?: DashIconName;
  children?: DashTreeNode[];
}

/** A group nav item: a parent header that holds children. The group has no
 *  `roles` of its own — visibility is derived from its children. A group
 *  shows up iff at least one of its children is visible for the current role. */
export interface DashGroup {
  kind: "group";
  label: string;
  icon?: DashIconName;
  children: DashLeaf[];
}

export type DashNavItem = DashLeaf | DashGroup;

export const dashboardNav: DashNavItem[] = [
  // Standalone top-level item.
  { kind: "leaf", label: "Overview", href: "/dashboard", roles: ROLES, icon: "home" },

  { kind: "group", label: "Academics", children: [
    { kind: "leaf", label: "Students", href: "/dashboard/students", roles: ["admin", "management", "teacher"], icon: "users" },
    { kind: "leaf", label: "Teachers", href: "/dashboard/teachers", roles: ["admin", "management"], icon: "teacher" },
  ]},

  { kind: "group", label: "Reports", children: [
    { kind: "leaf", label: "Results", href: "/dashboard/results", roles: ROLES, icon: "result" },
    { kind: "leaf", label: "Notices", href: "/dashboard/notices", roles: ROLES, icon: "notice" },
  ]},

  { kind: "group", label: "Account", children: [
    { kind: "leaf", label: "Profile", href: "/dashboard/profile", roles: ROLES, icon: "profile" },
    { kind: "leaf", label: "Settings", href: "/dashboard/settings", roles: ["admin", "management"], icon: "settings" },
  ]},
];

/** Returns a copy of `items` filtered for the given role.
 *  - Leaves are kept iff `role ∈ leaf.roles`.
 *  - Groups are kept iff at least one of their children survives the filter. */
export function filterNavForRole(items: DashNavItem[], role: Role): DashNavItem[] {
  return items.flatMap<DashNavItem>((item) => {
    if (item.kind === "leaf") return item.roles.includes(role) ? [item] : [];
    const visibleChildren = item.children.filter((c) => c.roles.includes(role));
    return visibleChildren.length > 0
      ? [{ ...item, children: visibleChildren }]
      : [];
  });
}

/* ------------------------------------------------------------------ */
/*  Multilevel treeview helpers                                        */
/* ------------------------------------------------------------------ */

/** Build a stable, unique key for a node from its path in the tree.
 *  Shared by both the open/closed state set and React keys so the two never
 *  drift apart (previously the open-set used index paths while React keys used
 *  labels, so auto-expanding the active branch silently no-op'd). */
export function nodeKey(node: DashTreeNode, parentKey: string | null): string {
  const labelPart = node.label.toLowerCase().replace(/\s+/g, "-");
  return parentKey ? `${parentKey}/${labelPart}` : labelPart;
}

/** Check whether a tree node or any of its descendants is active. */
export function isNodeOrChildActive(node: DashTreeNode, pathname: string): boolean {
  if (node.kind === "leaf") return node.href ? node.href === pathname || pathname.startsWith(node.href) : false;
  return (node.children ?? []).some((c) => isNodeOrChildActive(c, pathname));
}

/** Return the set of group keys that should be open by default — i.e. every
 *  ancestor of the branch containing the current route, so the active leaf is
 *  visible on first paint. Keys match `nodeKey` exactly. */
export function defaultOpenGroups(
  nodes: DashTreeNode[],
  pathname: string,
  parentKey: string | null = null,
): Set<string> {
  const open = new Set<string>();
  nodes.forEach((node) => {
    if (node.kind !== "group") return;
    const key = nodeKey(node, parentKey);
    if (isNodeOrChildActive(node, pathname)) {
      open.add(key);
      const nested = defaultOpenGroups(node.children ?? [], pathname, key);
      nested.forEach((k) => open.add(k));
    }
  });
  return open;
}

/** Filter a `DashTreeNode[]` tree by role, pruning empty branches. */
export function filterTreeForRole(
  nodes: DashTreeNode[],
  role: Role,
): DashTreeNode[] {
  return nodes.reduce<DashTreeNode[]>((acc, node) => {
    if (node.kind === "leaf") {
      if (node.roles?.includes(role)) acc.push(node);
      return acc;
    }
    const filtered = filterTreeForRole(node.children ?? [], role);
    if (filtered.length > 0) {
      acc.push({ ...node, children: filtered });
    }
    return acc;
  }, []);
}

/* ------------------------------------------------------------------ */
/*  Demo tree with multiple nesting levels (used by Sidebar)           */
/* ------------------------------------------------------------------ */

/** A richer demo tree that showcases multiple levels of nesting.
 *  Extend this to match your actual nav structure.
 */
export const dashboardTree: DashTreeNode[] = [
  // ── Overview (standalone leaf) ─────────────────────────────────
  { kind: "leaf", label: "Overview", href: "/dashboard", roles: ROLES, icon: "home" },

  // ── Academics ────────────────────────────────────────────────
  { kind: "group", label: "Academics", icon: "teacher", children: [
    { kind: "leaf", label: "Students", href: "/dashboard/students", roles: ["admin", "management", "teacher"], icon: "users" },
    { kind: "leaf", label: "Teachers", href: "/dashboard/teachers", roles: ["admin", "management"], icon: "teacher" },
    { kind: "group", label: "Classes", children: [
      { kind: "leaf", label: "Timetable", href: "/dashboard/classes/timetable", roles: ["admin", "management", "teacher"], icon: "calendar" },
      { kind: "leaf", label: "Subjects", href: "/dashboard/classes/subjects", roles: ["admin", "management"], icon: "book" },
      { kind: "group", label: "Sections", children: [
        { kind: "leaf", label: "Grade IV", href: "/dashboard/classes/sections/grade-iv", roles: ["admin", "management", "teacher"], icon: "book" },
        { kind: "leaf", label: "Grade V", href: "/dashboard/classes/sections/grade-v", roles: ["admin", "management", "teacher"], icon: "book" },
      ]},
    ]},
  ]},

  // ── Examinations ─────────────────────────────────────────────
  { kind: "group", label: "Examinations", icon: "result", children: [
    { kind: "leaf", label: "Results", href: "/dashboard/results", roles: ROLES, icon: "result" },
    { kind: "leaf", label: "Notice Board", href: "/dashboard/notices", roles: ROLES, icon: "notice" },
    ]},

  // ── Fees ─────────────────────────────────────────────────────
  { kind: "group", label: "Fees", children: [
    { kind: "leaf", label: "Fee Collection", href: "/dashboard/fees/collection", roles: ["admin", "management"], icon: "home" },
    { kind: "leaf", label: "Reports", href: "/dashboard/fees/reports", roles: ["admin", "management"], icon: "home" },
    ]},

  // ── Account ──────────────────────────────────────────────────
  { kind: "group", label: "Account", children: [
    { kind: "leaf", label: "Profile", href: "/dashboard/profile", roles: ROLES, icon: "profile" },
    { kind: "leaf", label: "Settings", href: "/dashboard/settings", roles: ["admin", "management"], icon: "settings" },
  ]},
];
