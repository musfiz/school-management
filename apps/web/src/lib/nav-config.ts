/* ----------------------------------------------------------------------------
   nav-config.ts — single source of truth for the dashboard sidebar.
   Strict MAXIMUM 2-LEVEL depth: Section divider -> Group -> Direct page link.
   Any 3rd-level sub-navigation MUST NOT live here — implement it as
   horizontal <Tabs /> or a <Stepper /> inside the target page itself.

   Permission model:
   - ONE gate: `menuSlug` → DB `menus` + `canView`.
   - Role defaults live in backend templates (`ROLE_DEFAULTS`) + per-user overrides;
     frontend hard-codes no role arrays.
   - Fail closed: missing flags / unmanaged slug ⇒ only `dashboard` (superadmin bypasses all).
---------------------------------------------------------------------------- */

import type { IconType } from "react-icons";
import {
  RiBellLine as Bell,
  RiClipboardLine as ClipboardList,
  RiFolderLine as FolderKanban,
  RiGlobeLine as Globe,
  RiGraduationCapLine as GraduationCap,
  RiHistoryLine as History,
  RiImageLine as Images,
  RiDashboardLine as LayoutDashboard,
  RiShieldCheckLine as ShieldCheck,
  RiSparklingLine as Sparkles,
  RiUserSettingsLine as UserCog,
} from "react-icons/ri";
import {
  FiAward as Award,
  FiBookOpen as BookOpen,
  FiCpu as Cpu,
  FiInfo as Info,
  FiPieChart as PieChart,
  FiSettings as Settings,
  FiSliders as SlidersHorizontal,
  FiUserPlus as UserPlus,
  FiUsers as Users,
  FiZap as Zap,
} from "react-icons/fi";
import {
  BiBuilding as Building2,
  BiIdCard as IdCard,
  BiReceipt as Receipt,
  BiSolidLandmark as Landmark,
  BiSpreadsheet as FileSpreadsheet,
} from "react-icons/bi";
import { GoCalendar as CalendarDays, GoMegaphone as Megaphone } from "react-icons/go";

/* ----------------------------------------------------------------------------
   DEV-ONLY (testing): bypasses ALL sidebar + palette role filtering so every
   screen is reachable when NEXT_PUBLIC_NAV_BYPASS=1 in non-production.
---------------------------------------------------------------------------- */
export const DEV_BYPASS_ROLE_FILTER =
  process.env.NEXT_PUBLIC_NAV_BYPASS === "1" && process.env.NODE_ENV !== "production";

/* ------------------------------------------------------------------ */
/*  Nav types — groups hold leaves ONLY (never another group)          */
/* ------------------------------------------------------------------ */

export interface NavLeaf {
  kind: "leaf";
  label: string;
  href: string;
  description?: string;
  icon?: IconType;
  badge?: string;
  /** Extra path prefixes that mark this leaf active (legacy parent pages). */
  matchPaths?: string[];
  /** Match href exactly (no prefix match) — used by legacy workspace leaves
   *  so they don't also light up when a sub-route leaf is active. */
  exactMatch?: boolean;
  keywords?: string[];
  /** `menus.slug` this leaf is permission-gated by (hybrid RBAC overlay).
   *  Children of a group inherit the group's slug when unset. Top-level leaves
   *  MUST declare their own slug. */
  menuSlug?: string;
}

export interface NavGroup {
  kind: "group";
  label: string;
  icon?: IconType;
  /** STRICT 2-LEVEL RULE: leaves only. No nested groups. */
  children: NavLeaf[];
  /** `menus.slug` inherited by children without their own `menuSlug`; also
   *  gates the group label itself (canView required to show it). */
  menuSlug: string;
}

/** Visual module divider (e.g. "Accounting & Finance"). Not clickable,
 *  not a nav level — it keeps the tree at max 2 levels. */
export interface NavSection {
  kind: "section";
  label: string;
}

export type TopLevelNavLeaf = NavLeaf & { menuSlug: string };
export type NavItem = TopLevelNavLeaf | NavGroup | NavSection;

/* ------------------------------------------------------------------ */
/*  Navigation tree                                                    */
/* ------------------------------------------------------------------ */

export const navItems: NavItem[] = [
  {
    kind: "leaf",
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    menuSlug: "dashboard",
  },

  /* ── Module A: Accounting & Finance (daily workflow order) ── */
  { kind: "section", label: "Accounting & Finance" },
  {
    kind: "leaf",
    label: "Financial & Audit Reports",
    href: "/admin/accounting/reports",
    description: "Receipts & payments, income & expenditure, balance sheet",
    icon: PieChart,
    menuSlug: "reports",
    keywords: [
      "reports",
      "receipts",
      "payments",
      "income",
      "expenditure",
      "balance",
      "defaulter",
      "audit",
    ],
  },
  {
    kind: "leaf",
    label: "Audit Trail",
    href: "/admin/accounting/audit",
    description: "Immutable voucher & posting audit log",
    icon: ShieldCheck,
    menuSlug: "accounting",
    keywords: ["audit", "trail", "log", "immutable"],
  },
  {
    kind: "leaf",
    label: "Quick Fee Collection (POS)",
    href: "/admin/accounting/collection",
    description: "Counter POS fee collection",
    icon: Zap,
    badge: "Hot",
    matchPaths: ["/admin/accounting/collection/pos"],
    menuSlug: "fees",
    keywords: ["pos", "collect", "cash", "counter", "fee"],
  },
  {
    kind: "leaf",
    label: "Student Billing & Waivers",
    href: "/admin/accounting/billing",
    description: "Auto-generate tuition & assign waivers",
    icon: Receipt,
    menuSlug: "fees",
    keywords: ["bill", "waiver", "tuition", "invoice"],
  },
  {
    kind: "group",
    label: "MFS & Bank Reconciliation",
    icon: Landmark,
    menuSlug: "bank_reconciliation",
    children: [
      {
        kind: "leaf",
        label: "Online Payment Logs",
        href: "/admin/accounting/reconciliation/logs",
        description: "bKash, Nagad, Rocket instant webhook logs",
        keywords: ["mfs", "bkash", "nagad", "rocket", "webhook", "gateway", "online"],
      },
      {
        kind: "leaf",
        label: "Gateway TDR Settlement",
        href: "/admin/accounting/reconciliation/tdr",
        description: "Merchant payout vs net bank deposit reconciliation",
        keywords: ["tdr", "settlement", "payout", "merchant", "charge"],
      },
      {
        kind: "leaf",
        label: "Bank Challan Verify",
        href: "/admin/accounting/reconciliation/challan",
        description: "Manual bank deposit slip batch upload & verify",
        keywords: ["challan", "bank", "deposit", "slip", "verify"],
      },
    ],
  },
  {
    kind: "leaf",
    label: "Vouchers & General Ledger",
    href: "/admin/accounting/vouchers",
    description: "Post debit, credit & journal entries",
    icon: FileSpreadsheet,
    menuSlug: "accounting",
    keywords: ["voucher", "journal", "debit", "credit", "ledger", "gl"],
  },
  {
    kind: "leaf",
    label: "Chart of Accounts & Funds",
    href: "/admin/accounting/chart-of-accounts",
    description: "5-Tier NBR compliant chart of accounts",
    icon: BookOpen,
    menuSlug: "accounting",
    keywords: ["chart", "account", "fund", "coa", "tier"],
  },
  {
    kind: "leaf",
    label: "Payables, Payroll & Tax (NBR)",
    href: "/admin/accounting/payables-tax",
    description: "Vendor bills, NBR VAT (Mushak 6.3) & TDS challans",
    icon: Building2,
    menuSlug: "accounting",
    keywords: ["payables", "tax", "vat", "mushak", "tds", "vendor", "challan"],
  },
  {
    kind: "leaf",
    label: "Payroll & MPO",
    href: "/admin/accounting/payroll",
    description: "Teacher salary disbursement & govt MPO claims",
    icon: UserCog,
    menuSlug: "payroll",
    keywords: ["payroll", "salary", "mpo", "disbursement"],
  },

  /* ── Module B: Exam & Result Engine ── */
  { kind: "section", label: "Exam & Result Engine" },
  {
    kind: "group",
    label: "Exam Setup & Rules",
    icon: SlidersHorizontal,
    menuSlug: "exam_setup",
    children: [
      {
        kind: "leaf",
        label: "Initial setup",
        href: "/admin/academic-results/settings/initial-setup",
        description: "Exam architecture initialization & status overview",
        keywords: ["exam", "setup", "rules", "architecture"],
      },
      {
        kind: "leaf",
        label: "Grading Scales",
        href: "/admin/academic-results/settings/grading-scales",
        description: "Board vs Cambridge vs Madrasah grading systems",
        keywords: ["grading", "scale", "gpa", "board", "cambridge"],
      },
      {
        kind: "leaf",
        label: "Syllabus & Paper Merge",
        href: "/admin/academic-results/settings/syllabus-matrix",
        description: "Combined pass rules (e.g. Bangla 1st + 2nd)",
        keywords: ["syllabus", "paper", "merge", "combined", "pass"],
      },
      {
        kind: "leaf",
        label: "Exam Terms & CT Rules",
        href: "/admin/academic-results/settings/term-types",
        description: "Term weights (e.g. 20% CT + 80% Final)",
        keywords: ["term", "ct", "weight", "exam term", "rules"],
      },
      {
        kind: "leaf",
        label: "Mark Distribution (CQ/MCQ)",
        href: "/admin/academic-results/exams/components",
        description: "CQ, MCQ, Practical pass thresholds",
        keywords: ["cq", "mcq", "practical", "distribution", "threshold"],
      },
    ],
  },
  {
    kind: "group",
    label: "Marks Entry Desk",
    icon: ClipboardList,
    menuSlug: "marks_entry",
    children: [
      {
        kind: "leaf",
        label: "Spreadsheet Marks Entry",
        href: "/admin/academic-results/marks-entry",
        description: "Fast Excel-like grid with arrow-key navigation",
        keywords: ["marks", "entry", "spreadsheet", "excel", "grid"],
      },
      {
        kind: "leaf",
        label: "CT / Incourse & Attendance",
        href: "/admin/academic-results/marks-entry/auto-sync",
        description: "Continuous assessment & attendance marks sync",
        keywords: ["ct", "incourse", "attendance", "sync"],
      },
      {
        kind: "leaf",
        label: "Bulk CSV / OMR Import",
        href: "/admin/academic-results/marks-entry/import",
        description: "Scan sheet import & bulk mark uploads",
        keywords: ["csv", "omr", "import", "bulk", "upload"],
      },
      {
        kind: "leaf",
        label: "Marks Submission Tracker",
        href: "/admin/academic-results/marks-entry/tracker",
        description: "Track teacher submission deadlines & missing marks",
        keywords: ["submission", "tracker", "deadline", "missing marks"],
      },
    ],
  },
  {
    kind: "leaf",
    label: "Generate & Publish Result",
    href: "/admin/academic-results/process",
    description: "Run GPA calculation engine & publish to students",
    icon: Zap,
    menuSlug: "results",
    keywords: ["generate", "publish", "gpa", "calculation", "results"],
  },
  {
    kind: "group",
    label: "Marksheets & Reports",
    icon: Award,
    menuSlug: "marksheets",
    children: [
      {
        kind: "leaf",
        label: "Student Marksheets (A4)",
        href: "/admin/academic-results/outputs/marksheets",
        description: "Print-ready student report cards with QR code",
        keywords: ["marksheet", "report card", "print", "a4", "transcript"],
      },
      {
        kind: "leaf",
        label: "Master Tabulation Sheet",
        href: "/admin/academic-results/outputs/tabulation-sheet",
        description: "Class-wide consolidated mark sheet for teachers",
        keywords: ["tabulation", "master sheet", "consolidated", "class"],
      },
      {
        kind: "leaf",
        label: "Merit & Fail List",
        href: "/admin/academic-results/outputs/merit-list",
        description: "Ranked position list & failed subject summary",
        keywords: ["merit", "rank", "fail list", "position", "top"],
      },
      {
        kind: "leaf",
        label: "Subject & Teacher Analytics",
        href: "/admin/academic-results/outputs/analytics",
        description: "Pass percentages, grade trends & subject breakdown",
        keywords: ["analytics", "performance", "trends", "pass percentage"],
      },
    ],
  },

  /* ── Module C: Academics & Students ── */
  { kind: "section", label: "Academics & Students" },
  {
    kind: "group",
    label: "Academics",
    icon: GraduationCap,
    menuSlug: "academics",
    children: [
      {
        kind: "leaf",
        label: "Class Schedule",
        href: "/admin/academic/class-schedule",
      },
      {
        kind: "leaf",
        label: "Academic Rules",
        href: "/admin/academic/academic-rules",
      },
      {
        kind: "leaf",
        label: "Calendar",
        href: "/admin/academic/calendar",
      },
      {
        kind: "leaf",
        label: "Attendance",
        href: "/admin/academic/attendance",
      },
      {
        kind: "leaf",
        label: "Leave Info",
        href: "/admin/academic/leave-info",
      },
      {
        kind: "leaf",
        label: "Staffs",
        href: "/admin/academic/staffs",
      },
    ],
  },
  {
    kind: "group",
    label: "Students",
    icon: Users,
    menuSlug: "students",
    children: [
      {
        kind: "leaf",
        label: "Student List",
        href: "/admin/students",
      },
      {
        kind: "leaf",
        label: "Teachers",
        href: "/admin/teachers",
        menuSlug: "teachers",
      },
      {
        kind: "leaf",
        label: "Exam Schedule",
        href: "/admin/student/exam-schedule",
      },
      {
        kind: "leaf",
        label: "Exam System",
        href: "/admin/student/exam-system",
      },
      {
        kind: "leaf",
        label: "Daily Activities",
        href: "/admin/student/daily-activities",
      },
      {
        kind: "leaf",
        label: "Rules",
        href: "/admin/student/rules",
      },
      {
        kind: "leaf",
        label: "Uniform",
        href: "/admin/student/uniform",
      },
    ],
  },

  /* ── Module D: Admission & Enrollment ── */
  { kind: "section", label: "Admission & Enrollment" },
  {
    kind: "group",
    label: "Admission Desk",
    icon: UserPlus,
    menuSlug: "admission",
    children: [
      {
        kind: "leaf",
        label: "Admission Dashboard",
        href: "/admin/admissions/dashboard",
        description: "Seats vs admitted, today's admissions, pending fees",
        keywords: ["admission dashboard", "seats", "capacity", "today"],
      },
      {
        kind: "leaf",
        label: "Campaigns & Circulars",
        href: "/admin/admissions/campaigns",
        description: "Session circulars, application deadlines & seat capacities",
        keywords: ["campaign", "circular", "seats", "session", "intake"],
      },
      {
        kind: "leaf",
        label: "Applications Pipeline",
        href: "/admin/admissions/applications",
        description: "Review, verify documents, shortlist & approve applicants",
        badge: "Live",
        keywords: ["applications", "pipeline", "scrutiny", "admit card"],
      },
      {
        kind: "leaf",
        label: "Direct Admission Wizard",
        href: "/admin/admissions/direct-admission",
        description: "Spot admissions desk — 5-step registration",
        keywords: ["direct admission", "spot", "wizard", "walk-in"],
      },
    ],
  },
  {
    kind: "group",
    label: "Student Registry",
    icon: FolderKanban,
    menuSlug: "student_registry",
    children: [
      {
        kind: "leaf",
        label: "Students Directory",
        href: "/admin/admissions/students",
        description: "Master student database with roll, section & guardian links",
        keywords: ["directory", "master", "database", "students list"],
      },
      {
        kind: "leaf",
        label: "Families Directory",
        href: "/admin/admissions/families",
        description: "Parent / guardian accounts, emergency contacts & sibling links",
        keywords: ["family", "parent", "guardian", "sibling", "emergency"],
      },
      {
        kind: "leaf",
        label: "Documents & Verification",
        href: "/admin/admissions/documents",
        description: "Birth certs, NID, photos & transfer cert repository",
        keywords: ["documents", "nid", "birth certificate", "tc", "photos"],
      },
    ],
  },
  {
    kind: "group",
    label: "Enrollment Lifecycle",
    icon: ClipboardList,
    menuSlug: "enrollment",
    children: [
      {
        kind: "leaf",
        label: "Enrollments & Sections",
        href: "/admin/admissions/enrollments",
        description: "Session-wise class & section assignments with roll allocations",
        keywords: ["enrollment", "section assignment", "roll allocate"],
      },
      {
        kind: "leaf",
        label: "Promotion & TC Issue",
        href: "/admin/admissions/promotion-tc",
        description: "Year-end class promotion, retention & transfer certificates",
        keywords: ["promotion", "tc", "transfer certificate", "retention"],
      },
      {
        kind: "leaf",
        label: "Previous Education",
        href: "/admin/admissions/previous-education",
        description: "Prior school records, board exam rolls & GPA history",
        keywords: ["previous", "ssc", "dakhil", "hsc", "board", "gpa", "history"],
      },
    ],
  },
  {
    kind: "group",
    label: "Admission Settings",
    icon: Settings,
    menuSlug: "admission_settings",
    children: [
      {
        kind: "leaf",
        label: "ID & Roll Formats",
        href: "/admin/admissions/settings/id-formats",
        description: "Student ID + roll sequence builder with row-lock safety",
        keywords: ["id format", "roll", "sequence", "builder"],
      },
      {
        kind: "leaf",
        label: "Quota & Waiver Presets",
        href: "/admin/admissions/settings/waiver-presets",
        description: "Merit, sibling, freedom-fighter, orphan/Lillah presets",
        keywords: ["quota", "waiver", "preset", "merit", "sibling", "lillah", "scholarship"],
      },
      {
        kind: "leaf",
        label: "Required Documents",
        href: "/admin/admissions/settings/documents",
        description: "Per-class required-document checklist",
        keywords: ["required", "document", "checklist", "settings"],
      },
    ],
  },

  /* ── Module E: Website & Information ── */
  { kind: "section", label: "Website & Information" },
  {
    kind: "group",
    label: "Website Management",
    icon: Globe,
    menuSlug: "website",
    children: [
      {
        kind: "leaf",
        label: "Navigation Menu",
        href: "/admin/website-management/navigation-menu",
      },
      {
        kind: "leaf",
        label: "Site Settings",
        href: "/admin/website-management/site-settings",
      },
      {
        kind: "leaf",
        label: "Hero Section",
        href: "/admin/website-management/hero-section",
        icon: Sparkles,
      },
      {
        kind: "leaf",
        label: "Slider",
        href: "/admin/website-management/sliders",
        icon: Images,
      },
      {
        kind: "leaf",
        label: "Gallery",
        href: "/admin/website-management/gallery",
        icon: Images,
      },
      {
        kind: "leaf",
        label: "Notice Board",
        href: "/admin/notices",
        icon: Megaphone,
      },
      {
        kind: "leaf",
        label: "About Us",
        href: "/admin/website-management/about-us",
        icon: Info,
      },
      {
        kind: "leaf",
        label: "History",
        href: "/admin/website-management/history",
        icon: History,
      },
      {
        kind: "leaf",
        label: "Chairman Speech",
        href: "/admin/website-management/chairman-speech",
      },
      {
        kind: "leaf",
        label: "Principal Speech",
        href: "/admin/website-management/principal-speech",
      },
      {
        kind: "leaf",
        label: "Governing Body",
        href: "/admin/website-management/governing-body",
      },
      {
        kind: "leaf",
        label: "Ex-Principals",
        href: "/admin/website-management/ex-principals",
      },
      {
        kind: "leaf",
        label: "Website Teachers",
        href: "/admin/website-management/teachers",
      },
      {
        kind: "leaf",
        label: "Staff Information",
        href: "/admin/website-management/staff",
      },
    ],
  },
  {
    kind: "group",
    label: "Facilities",
    icon: Sparkles,
    menuSlug: "facilities",
    children: [
      {
        kind: "leaf",
        label: "Library",
        href: "/admin/facilities/library",
      },
      {
        kind: "leaf",
        label: "Playground",
        href: "/admin/facilities/playground",
      },
      {
        kind: "leaf",
        label: "Physics Lab",
        href: "/admin/facilities/physics-lab",
      },
      {
        kind: "leaf",
        label: "Biology Lab",
        href: "/admin/facilities/biology-lab",
      },
      {
        kind: "leaf",
        label: "ICT Lab",
        href: "/admin/facilities/ict-lab",
      },
      {
        kind: "leaf",
        label: "Chemistry Lab",
        href: "/admin/facilities/chemistry-lab",
      },
      {
        kind: "leaf",
        label: "Extra Activities",
        href: "/admin/facilities/extra-activities",
      },
    ],
  },
  {
    kind: "group",
    label: "Others",
    icon: Bell,
    menuSlug: "others",
    children: [
      {
        kind: "leaf",
        label: "News",
        href: "/admin/others/news",
      },
      {
        kind: "leaf",
        label: "Events",
        href: "/admin/others/event",
        icon: CalendarDays,
      },
      {
        kind: "leaf",
        label: "Routine",
        href: "/admin/others/routine",
        icon: CalendarDays,
      },
      {
        kind: "leaf",
        label: "Downloads",
        href: "/admin/others/download",
      },
    ],
  },

  /* ── Module F: System ── */
  { kind: "section", label: "System" },
  {
    kind: "group",
    label: "Permission Management",
    icon: ShieldCheck,
    menuSlug: "permission_management",
    children: [
      {
        kind: "leaf",
        label: "System Menus",
        href: "/admin/permission-management/menus",
      },
      {
        kind: "leaf",
        label: "User Permissions",
        href: "/admin/permission-management/user-permissions",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Keys, active-state & filtering helpers                             */
/* ------------------------------------------------------------------ */

/** Stable key for accordion state + React keys. */
export function navKey(label: string, parentKey: string | null): string {
  const part = label.toLowerCase().replace(/\s+/g, "-");
  return parentKey ? `${parentKey}/${part}` : part;
}

export function isLeafActive(leaf: NavLeaf, pathname: string): boolean {
  if (leaf.href === "/admin") return pathname === "/admin";
  if (leaf.exactMatch) return pathname === leaf.href;
  if (leaf.href === pathname || pathname.startsWith(`${leaf.href}/`)) return true;
  return (leaf.matchPaths ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.children.some((c) => isLeafActive(c, pathname));
}

/** Groups open on first paint so the active leaf is visible. */
export function defaultOpenGroups(items: NavItem[], pathname: string): Set<string> {
  const open = new Set<string>();
  for (const item of items) {
    if (item.kind !== "group") continue;
    if (isGroupActive(item, pathname)) open.add(navKey(item.label, null));
  }
  return open;
}

function pruneLeadingSections(items: NavItem[]): NavItem[] {
  let i = 0;
  while (i < items.length && items[i].kind === "section") {
    const hasPreceding = items.slice(0, i).some((n) => n.kind !== "section");
    if (hasPreceding) break;
    const hasFollowing = items.slice(i + 1).some((n) => n.kind !== "section");
    if (i === 0 && hasFollowing) break;
    i++;
  }
  return items.filter((n, idx) => {
    if (n.kind !== "section") return true;
    if (idx < i) return false;
    const prev = items[idx - 1];
    return !(prev && prev.kind === "section");
  });
}

/** Drop section dividers that have no visible item after them. */
export function pruneEmptySections(items: NavItem[]): NavItem[] {
  const pruned: NavItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== "section") {
      pruned.push(item);
      continue;
    }
    const hasVisibleAfter = items.slice(i + 1).some((n) => n.kind !== "section");
    if (hasVisibleAfter) pruned.push(item);
  }
  return pruneLeadingSections(pruned);
}

/* ------------------------------------------------------------------ */
/*  Menu permission flags & single unified filter                      */
/* ------------------------------------------------------------------ */

/**
 * Per-menu `canView` flags fetched server-side from GET /menus/my-menus.
 * `canView` maps `menus.slug` → granted. Missing or unmanaged slugs fail closed
 * unless superadmin bypass is active.
 */
export interface MenuPermissionFlags {
  canView: Record<string, boolean>;
  /** True for superadmin sessions — every screen stays visible. */
  bypassAll?: boolean;
}

/**
 * Unified filter for the dashboard nav tree:
 * - When dev bypass is active: returns all items.
 * - When flags?.bypassAll is true (superadmin): returns all items.
 * - When flags is null or undefined (fetch failed / no session): fails closed
 *   to the "dashboard" leaf only.
 * - Otherwise: only leaves/groups whose resolved slug has canView === true are kept.
 */
export function filterNav(
  items: NavItem[],
  flags: MenuPermissionFlags | null | undefined,
): NavItem[] {
  if (DEV_BYPASS_ROLE_FILTER) return items;
  if (flags?.bypassAll) return items;

  // Fail closed when no flags are present: dashboard leaf only
  if (!flags) {
    const out: NavItem[] = [];
    for (const item of items) {
      if (item.kind === "leaf" && item.menuSlug === "dashboard") {
        out.push(item);
      }
    }
    return pruneEmptySections(out);
  }

  const out: NavItem[] = [];
  for (const item of items) {
    if (item.kind === "section") {
      out.push(item);
      continue;
    }
    if (item.kind === "leaf") {
      if (flags.canView[item.menuSlug] === true) {
        out.push(item);
      }
      continue;
    }
    // Group: requires group slug to be granted in canView
    if (flags.canView[item.menuSlug] !== true) {
      continue;
    }
    // Filter group's children: child slug defaults to group's slug
    const visibleChildren = item.children.filter((child) => {
      const childSlug = child.menuSlug ?? item.menuSlug;
      return flags.canView[childSlug] === true;
    });
    if (visibleChildren.length > 0) {
      out.push({ ...item, children: visibleChildren });
    }
  }

  return pruneEmptySections(out);
}

/* ------------------------------------------------------------------ */
/*  Command palette index — flat searchable helper for Ctrl+K.         */
/* ------------------------------------------------------------------ */

export interface NavCommand {
  label: string;
  group: string | null;
  href: string;
  keywords: string[];
}

function buildCommandIndex(items: NavItem[]): NavCommand[] {
  const index: NavCommand[] = [];
  for (const item of items) {
    if (item.kind === "leaf") {
      index.push({
        label: item.label,
        group: null,
        href: item.href,
        keywords: [item.label, item.description ?? "", ...(item.keywords ?? [])],
      });
    } else if (item.kind === "group") {
      for (const child of item.children) {
        index.push({
          label: child.label,
          group: item.label,
          href: child.href,
          keywords: [child.label, item.label, child.description ?? "", ...(child.keywords ?? [])],
        });
      }
    }
  }
  return index;
}

/** Flat index over a pre-filtered list of visible nav items. */
export function commandIndex(items: NavItem[] = navItems): NavCommand[] {
  return buildCommandIndex(items);
}

/** All leaves, unfiltered. */
export const commandPaletteIndex: NavCommand[] = buildCommandIndex(navItems);

/** Alias kept for consumers expecting a `flatNavIndex` name. */
export const flatNavIndex: NavCommand[] = commandPaletteIndex;

/** Case-insensitive substring search over label + group + keywords. */
export function searchNav(index: NavCommand[], query: string): NavCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return index;
  return index.filter((c) =>
    `${c.group ?? ""} ${c.label} ${c.keywords.join(" ")}`.toLowerCase().includes(q),
  );
}
