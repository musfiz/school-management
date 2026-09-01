/* ----------------------------------------------------------------------------
   Dashboard role model & navigation.
   Single source of truth for the protected area: who can see what.
   Wired to the mock role-gate today; swap RoleProvider for a real session
   later and this file stays the same.
---------------------------------------------------------------------------- */

export type Role = "admin" | "management" | "teacher" | "student" | "guardian";

export const ROLES: Role[] = ["admin", "management", "teacher", "student", "guardian"];

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
  | "book"
  | "info"
  | "admission"
  | "student"
  | "facilities"
  | "others"
  | "about"
  | "library"
  | "lab"
  | "fees"
  | "exam"
  | "gallery"
  | "download";

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
  { kind: "leaf", label: "Overview", href: "/admin", roles: ROLES, icon: "home" },

  {
    kind: "group",
    label: "Academics",
    children: [
      {
        kind: "leaf",
        label: "Students",
        href: "/admin/students",
        roles: ["admin", "management", "teacher"],
        icon: "users",
      },
      {
        kind: "leaf",
        label: "Teachers",
        href: "/admin/teachers",
        roles: ["admin", "management"],
        icon: "teacher",
      },
    ],
  },

  {
    kind: "group",
    label: "Reports",
    children: [
      { kind: "leaf", label: "Results", href: "/admin/results", roles: ROLES, icon: "result" },
      { kind: "leaf", label: "Notices", href: "/admin/notices", roles: ROLES, icon: "notice" },
    ],
  },

  {
    kind: "group",
    label: "Account",
    children: [
      { kind: "leaf", label: "Profile", href: "/admin/profile", roles: ROLES, icon: "profile" },
      {
        kind: "leaf",
        label: "Settings",
        href: "/admin/settings",
        roles: ["admin", "management"],
        icon: "settings",
      },
    ],
  },
];

/** Returns a copy of `items` filtered for the given role.
 *  - Leaves are kept iff `role ∈ leaf.roles`.
 *  - Groups are kept iff at least one of their children survives the filter. */
export function filterNavForRole(items: DashNavItem[], role: Role): DashNavItem[] {
  return items.flatMap<DashNavItem>((item) => {
    if (item.kind === "leaf") return item.roles.includes(role) ? [item] : [];
    const visibleChildren = item.children.filter((c) => c.roles.includes(role));
    return visibleChildren.length > 0 ? [{ ...item, children: visibleChildren }] : [];
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
  if (node.kind === "leaf")
    return node.href ? node.href === pathname || pathname.startsWith(node.href) : false;
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
export function filterTreeForRole(nodes: DashTreeNode[], role: Role): DashTreeNode[] {
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
  { kind: "leaf", label: "Overview", href: "/admin", roles: ROLES, icon: "home" },
  // ── Website Management ───────────────────────────────────────
  {
    kind: "group",
    label: "Website Management",
    icon: "info",
    children: [
      {
        kind: "leaf",
        label: "Navigation Menu",
        href: "/admin/website-management/navigation-menu",
        roles: ["admin", "management"],
        icon: "settings",
      },
      {
        kind: "leaf",
        label: "Site Settings",
        href: "/admin/website-management/site-settings",
        roles: ["admin", "management"],
        icon: "settings",
      },
      {
        kind: "leaf",
        label: "About Us",
        href: "/admin/website-management/about-us",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "History",
        href: "/admin/website-management/history",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Governing Body",
        href: "/admin/website-management/governing-body",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Menu",
        href: "/admin/website-management/menu",
        roles: ROLES,
        icon: "about",
      },
    ],
  },
  // ── About ─────────────────────────────────────────────────────
  {
    kind: "group",
    label: "About",
    icon: "about",
    children: [
      {
        kind: "leaf",
        label: "About Us",
        href: "/admin/about/about-us",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "History",
        href: "/admin/about/history",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Donor List",
        href: "/admin/about/donor-list",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Mission & Vision",
        href: "/admin/about/mission-vision",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Campus Tour",
        href: "/admin/about/campus-tour",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Achievements",
        href: "/admin/about/achievements",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Chairman Speech",
        href: "/admin/about/chairman-speech",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Governing Body",
        href: "/admin/about/governing-body",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Principal Speech",
        href: "/admin/about/principal-speech",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Ex-Principals",
        href: "/admin/about/ex-principals",
        roles: ROLES,
        icon: "about",
      },
      {
        kind: "leaf",
        label: "Administrators",
        href: "/admin/about/administrators",
        roles: ROLES,
        icon: "about",
      },
    ],
  },

  // ── Information ────────────────────────────────────────────────
  {
    kind: "group",
    label: "Information",
    icon: "info",
    children: [
      {
        kind: "leaf",
        label: "Permission & Recognition",
        href: "/admin/information/permission-recognition-letter",
        roles: ROLES,
        icon: "info",
      },
      {
        kind: "leaf",
        label: "Nationalization",
        href: "/admin/information/nationalization",
        roles: ROLES,
        icon: "info",
      },
      {
        kind: "leaf",
        label: "Statistics Report",
        href: "/admin/information/statistics-report",
        roles: ROLES,
        icon: "info",
      },
      {
        kind: "leaf",
        label: "Govt. Approval Letter",
        href: "/admin/information/govt-approval-letter",
        roles: ROLES,
        icon: "info",
      },
    ],
  },

  // ── Academics ────────────────────────────────────────────────
  {
    kind: "group",
    label: "Academics",
    icon: "teacher",
    children: [
      {
        kind: "leaf",
        label: "Class Schedule",
        href: "/admin/academic/class-schedule",
        roles: ROLES,
        icon: "calendar",
      },
      {
        kind: "leaf",
        label: "Teachers",
        href: "/admin/teachers",
        roles: ["admin", "management"],
        icon: "teacher",
      },
      {
        kind: "leaf",
        label: "Staffs",
        href: "/admin/academic/staffs",
        roles: ROLES,
        icon: "users",
      },
      {
        kind: "leaf",
        label: "Academic Rules",
        href: "/admin/academic/academic-rules",
        roles: ROLES,
        icon: "book",
      },
      {
        kind: "leaf",
        label: "Calendar",
        href: "/admin/academic/calendar",
        roles: ROLES,
        icon: "calendar",
      },
      {
        kind: "leaf",
        label: "Attendance",
        href: "/admin/academic/attendance",
        roles: ROLES,
        icon: "book",
      },
      {
        kind: "leaf",
        label: "Leave Info",
        href: "/admin/academic/leave-info",
        roles: ROLES,
        icon: "book",
      },
    ],
  },

  // ── Admission ────────────────────────────────────────────────
  {
    kind: "group",
    label: "Admission",
    icon: "admission",
    children: [
      {
        kind: "leaf",
        label: "Why Study Here",
        href: "/admin/admission/why-study",
        roles: ROLES,
        icon: "admission",
      },
      {
        kind: "leaf",
        label: "How to Apply",
        href: "/admin/admission/how-to-apply",
        roles: ROLES,
        icon: "admission",
      },
      {
        kind: "leaf",
        label: "Admission Test",
        href: "/admin/admission/admission-test",
        roles: ROLES,
        icon: "admission",
      },
      {
        kind: "leaf",
        label: "Policy",
        href: "/admin/admission/policy",
        roles: ROLES,
        icon: "admission",
      },
      {
        kind: "leaf",
        label: "Registration System",
        href: "/admin/admission/registration-system",
        roles: ROLES,
        icon: "admission",
      },
    ],
  },

  // ── Student ───────────────────────────────────────────────────
  {
    kind: "group",
    label: "Student",
    icon: "student",
    children: [
      {
        kind: "leaf",
        label: "Student List",
        href: "/admin/students",
        roles: ["admin", "management", "teacher"],
        icon: "users",
      },
      {
        kind: "leaf",
        label: "Tuition Fees",
        href: "/admin/student/tuition-fees",
        roles: ROLES,
        icon: "fees",
      },
      {
        kind: "leaf",
        label: "Mobile Banking",
        href: "/admin/student/mobile-banking",
        roles: ROLES,
        icon: "fees",
      },
      {
        kind: "leaf",
        label: "Daily Activities",
        href: "/admin/student/daily-activities",
        roles: ROLES,
        icon: "student",
      },
      {
        kind: "leaf",
        label: "Exam Schedule",
        href: "/admin/student/exam-schedule",
        roles: ROLES,
        icon: "exam",
      },
      {
        kind: "leaf",
        label: "Uniform",
        href: "/admin/student/uniform",
        roles: ROLES,
        icon: "student",
      },
      {
        kind: "leaf",
        label: "Exam System",
        href: "/admin/student/exam-system",
        roles: ROLES,
        icon: "exam",
      },
      {
        kind: "leaf",
        label: "Rules",
        href: "/admin/student/rules",
        roles: ROLES,
        icon: "book",
      },
    ],
  },

  // ── Facilities ────────────────────────────────────────────────
  {
    kind: "group",
    label: "Facilities",
    icon: "facilities",
    children: [
      {
        kind: "leaf",
        label: "Library",
        href: "/admin/facilities/library",
        roles: ROLES,
        icon: "library",
      },
      {
        kind: "leaf",
        label: "Playground",
        href: "/admin/facilities/playground",
        roles: ROLES,
        icon: "facilities",
      },
      {
        kind: "leaf",
        label: "Physics Lab",
        href: "/admin/facilities/physics-lab",
        roles: ROLES,
        icon: "lab",
      },
      {
        kind: "leaf",
        label: "Biology Lab",
        href: "/admin/facilities/biology-lab",
        roles: ROLES,
        icon: "lab",
      },
      {
        kind: "leaf",
        label: "ICT Lab",
        href: "/admin/facilities/ict-lab",
        roles: ROLES,
        icon: "lab",
      },
      {
        kind: "leaf",
        label: "Chemistry Lab",
        href: "/admin/facilities/chemistry-lab",
        roles: ROLES,
        icon: "lab",
      },
      {
        kind: "leaf",
        label: "Extra Activities",
        href: "/admin/facilities/extra-activities",
        roles: ROLES,
        icon: "facilities",
      },
    ],
  },

  // ── Results ──────────────────────────────────────────────────
  {
    kind: "group",
    label: "Results",
    icon: "result",
    children: [
      {
        kind: "leaf",
        label: "Exam Results",
        href: "/admin/results",
        roles: ROLES,
        icon: "result",
      },
      {
        kind: "leaf",
        label: "Academic Results",
        href: "/admin/results/academic-result",
        roles: ROLES,
        icon: "result",
      },
      {
        kind: "leaf",
        label: "Evaluation Results",
        href: "/admin/results/evaluation-result",
        roles: ROLES,
        icon: "result",
      },
      {
        kind: "leaf",
        label: "Board Exam Results",
        href: "/admin/results/board-exam-result",
        roles: ROLES,
        icon: "result",
      },
    ],
  },

  // ── Others ───────────────────────────────────────────────────
  {
    kind: "group",
    label: "Others",
    icon: "others",
    children: [
      {
        kind: "leaf",
        label: "Notice Board",
        href: "/admin/notices",
        roles: ROLES,
        icon: "notice",
      },
      { kind: "leaf", label: "News", href: "/admin/others/news", roles: ROLES, icon: "others" },
      {
        kind: "leaf",
        label: "Gallery",
        href: "/admin/others/gallery",
        roles: ROLES,
        icon: "gallery",
      },
      {
        kind: "leaf",
        label: "Events",
        href: "/admin/others/event",
        roles: ROLES,
        icon: "others",
      },
      {
        kind: "leaf",
        label: "Routine",
        href: "/admin/others/routine",
        roles: ROLES,
        icon: "calendar",
      },
      {
        kind: "leaf",
        label: "Downloads",
        href: "/admin/others/download",
        roles: ROLES,
        icon: "download",
      },
    ],
  },

  // ── Fees ─────────────────────────────────────────────────────
  {
    kind: "group",
    label: "Fees",
    icon: "fees",
    children: [
      {
        kind: "leaf",
        label: "Fee Collection",
        href: "/admin/fees/collection",
        roles: ["admin", "management"],
        icon: "fees",
      },
      {
        kind: "leaf",
        label: "Fee Reports",
        href: "/admin/fees/reports",
        roles: ["admin", "management"],
        icon: "fees",
      },
      {
        kind: "leaf",
        label: "Tuition Fees",
        href: "/admin/student/tuition-fees",
        roles: ROLES,
        icon: "fees",
      },
      {
        kind: "leaf",
        label: "Mobile Banking",
        href: "/admin/student/mobile-banking",
        roles: ROLES,
        icon: "fees",
      },
    ],
  },

  // ── Account ──────────────────────────────────────────────────
  {
    kind: "group",
    label: "Account",
    children: [
      { kind: "leaf", label: "Profile", href: "/admin/profile", roles: ROLES, icon: "profile" },
      {
        kind: "leaf",
        label: "Settings",
        href: "/admin/settings",
        roles: ["admin", "management"],
        icon: "settings",
      },
    ],
  },
];
