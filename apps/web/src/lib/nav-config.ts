/* ----------------------------------------------------------------------------
   nav-config.ts — single source of truth for the dashboard sidebar.
   Strict MAXIMUM 2-LEVEL depth: Section divider -> Group -> Direct page link.
   Any 3rd-level sub-navigation MUST NOT live here — implement it as
   horizontal <Tabs /> or a <Stepper /> inside the target page itself.

   Role model:
   - `roles: UserRole[]` is canonical (used by filterNavForUserRole and the
     command palette). Every group AND every leaf carries it.
   - `legacyRoles: Role[]` mirrors the current mock session gate
     (admin/management/accountant/teacher/student/guardian) so existing
     logins keep working. New items map to the closest legacy equivalent.
     When the real session lands, delete `legacyRoles` and switch Sidebar
     to `filterNavForUserRole`.
---------------------------------------------------------------------------- */

import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bell,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  Cpu,
  FileSpreadsheet,
  FolderKanban,
  Globe,
  GraduationCap,
  History,
  IdCard,
  Images,
  Info,
  Landmark,
  LayoutDashboard,
  Megaphone,
  PieChart,
  Receipt,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { Role } from "./dashboard-nav";

/* ------------------------------------------------------------------ */
/*  Role model                                                         */
/* ------------------------------------------------------------------ */

export type UserRole =
  | "SUPER_ADMIN"
  | "PRINCIPAL"
  | "ACCOUNTANT"
  | "CASHIER"
  | "EXAM_CONTROLLER"
  | "TEACHER";

export const USER_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "PRINCIPAL",
  "ACCOUNTANT",
  "CASHIER",
  "EXAM_CONTROLLER",
  "TEACHER",
];

const ALL: UserRole[] = [...USER_ROLES];
const FINANCE_FULL: UserRole[] = ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"];
const EXAM_FULL: UserRole[] = ["SUPER_ADMIN", "PRINCIPAL", "EXAM_CONTROLLER"];
const ADMISSION_FULL: UserRole[] = ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

/* ----------------------------------------------------------------------------
   DEV-ONLY (testing): bypasses ALL sidebar + palette role filtering so every
   screen is reachable while the real role commands are still being built.
   Set to `false` (or delete the bypass lines) once role generation lands.
---------------------------------------------------------------------------- */
export const DEV_BYPASS_ROLE_FILTER = true;

/* ------------------------------------------------------------------ */
/*  Nav types — groups hold leaves ONLY (never another group)          */
/* ------------------------------------------------------------------ */

export interface NavLeaf {
  kind: "leaf";
  label: string;
  href: string;
  description?: string;
  icon?: LucideIcon;
  /** Canonical RBAC gate. */
  roles: UserRole[];
  /** Mock-gate bridge (current Session role). Remove with the mock gate. */
  legacyRoles: Role[];
  badge?: string;
  /** Extra path prefixes that mark this leaf active (legacy parent pages). */
  matchPaths?: string[];
  /** Match href exactly (no prefix match) — used by legacy workspace leaves
   *  so they don't also light up when a sub-route leaf is active. */
  exactMatch?: boolean;
  keywords?: string[];
}

export interface NavGroup {
  kind: "group";
  label: string;
  icon?: LucideIcon;
  /** Group-level RBAC gate AND at least one visible child are both required. */
  roles: UserRole[];
  legacyRoles: Role[];
  /** STRICT 2-LEVEL RULE: leaves only. No nested groups. */
  children: NavLeaf[];
}

/** Visual module divider (e.g. "Accounting & Finance"). Not clickable,
 *  not a nav level — it keeps the tree at max 2 levels. */
export interface NavSection {
  kind: "section";
  label: string;
}

export type NavItem = NavLeaf | NavGroup | NavSection;

/* ------------------------------------------------------------------ */
/*  Navigation tree                                                    */
/* ------------------------------------------------------------------ */

const FINANCE_LEGACY: Role[] = ["admin", "management", "accountant"];

export const navItems: NavItem[] = [
  { kind: "leaf", label: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },

  /* ── Module A: Accounting & Finance (daily workflow order) ── */
  { kind: "section", label: "Accounting & Finance" },
  {
    kind: "leaf",
    label: "Financial & Audit Reports",
    href: "/admin/accounting/reports",
    description: "Receipts & payments, income & expenditure, balance sheet",
    icon: PieChart,
    roles: FINANCE_FULL,
    legacyRoles: FINANCE_LEGACY,
    keywords: ["reports", "receipts", "payments", "income", "expenditure", "balance", "defaulter", "audit"],
  },
  {
    kind: "leaf",
    label: "Audit Trail",
    href: "/admin/accounting/audit",
    description: "Immutable voucher & posting audit log",
    icon: ShieldCheck,
    roles: FINANCE_FULL,
    legacyRoles: FINANCE_LEGACY,
    keywords: ["audit", "trail", "log", "immutable"],
  },
  {
    kind: "leaf",
    label: "Quick Fee Collection (POS)",
    href: "/admin/accounting/collection",
    description: "Counter POS fee collection",
    icon: Zap,
    roles: ["SUPER_ADMIN", "ACCOUNTANT", "CASHIER"],
    legacyRoles: FINANCE_LEGACY,
    badge: "Hot",
    matchPaths: ["/admin/accounting/collection/pos"],
    keywords: ["pos", "collect", "cash", "counter", "fee"],
  },
  {
    kind: "leaf",
    label: "Student Billing & Waivers",
    href: "/admin/accounting/billing",
    description: "Fee structures, waivers, invoices & deposits",
    icon: Receipt,
    roles: FINANCE_FULL,
    legacyRoles: FINANCE_LEGACY,
    keywords: ["billing", "invoice", "fee", "waiver", "scholarship", "deposit"],
  },
  {
    kind: "group",
    label: "MFS & Bank Reconciliation",
    icon: Landmark,
    roles: FINANCE_FULL,
    legacyRoles: FINANCE_LEGACY,
    children: [
      {
        kind: "leaf",
        label: "Online Payment Logs",
        href: "/admin/accounting/reconciliation/mfs-logs",
        description: "bKash, Nagad, SSLCommerz, EkPay webhooks",
        roles: FINANCE_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["bkash", "nagad", "sslcommerz", "ekpay", "webhook", "mfs"],
      },
      {
        kind: "leaf",
        label: "Gateway TDR Settlement",
        href: "/admin/accounting/reconciliation/settlements",
        description: "Gateway commission split & bank transfer",
        roles: FINANCE_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["tdr", "settlement", "commission", "gateway"],
      },
      {
        kind: "leaf",
        label: "Bank Challan Verify",
        href: "/admin/accounting/reconciliation/challans",
        description: "Barcode challan & bank scroll matching",
        roles: ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT", "CASHIER"],
        legacyRoles: FINANCE_LEGACY,
        keywords: ["challan", "bank", "scroll", "verify", "barcode"],
      },
    ],
  },
  {
    kind: "leaf",
    label: "Vouchers & General Ledger",
    href: "/admin/accounting/vouchers",
    description: "Receive, Payment, Journal, Contra + approvals",
    icon: BookOpenCheck,
    roles: ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT", "CASHIER"],
    legacyRoles: FINANCE_LEGACY,
    keywords: ["voucher", "receive", "payment", "journal", "contra", "approval", "ledger"],
  },
  {
    kind: "leaf",
    label: "Chart of Accounts & Funds",
    href: "/admin/accounting/chart-of-accounts",
    description: "5-digit CoA + General vs. Lillah/Zakat Fund setup",
    icon: BookOpen,
    roles: FINANCE_FULL,
    legacyRoles: FINANCE_LEGACY,
    keywords: ["chart of accounts", "coa", "fund", "lillah", "zakat", "ledger"],
  },
  {
    kind: "leaf",
    label: "Payables, Payroll & Tax (NBR)",
    href: "/admin/accounting/payables-tax",
    description: "Vendor bills, payroll, VDS/TDS & treasury challans",
    icon: Building2,
    roles: FINANCE_FULL,
    legacyRoles: FINANCE_LEGACY,
    keywords: ["payables", "payroll", "mpo", "vendor", "vds", "tds", "nbr", "tax", "challan", "pf"],
  },
  {
    kind: "leaf",
    label: "Payroll & MPO",
    href: "/admin/accounting/payroll",
    description: "MPO vs. institutional split, PF & gratuity",
    icon: Users,
    roles: FINANCE_FULL,
    legacyRoles: FINANCE_LEGACY,
    keywords: ["payroll", "salary", "mpo", "pf", "gratuity"],
  },

  /* ── Module B: Exam & Result Engine (chronological exam lifecycle) ── */
  { kind: "section", label: "Exam & Result Engine" },
  {
    kind: "group",
    label: "Exam Setup & Rules",
    icon: SlidersHorizontal,
    roles: EXAM_FULL,
    legacyRoles: ["admin", "management"],
    children: [
      {
        kind: "leaf",
        label: "Grading Scales",
        href: "/admin/academic-results/settings/grading-scales",
        description: "5.00 Board, 4.00 NU/IAU Honours, Primary 4-Tier",
        roles: EXAM_FULL,
        legacyRoles: ["admin", "management"],
        keywords: ["grading", "scale", "gpa", "cgpa", "grade"],
      },
      {
        kind: "leaf",
        label: "Syllabus & Paper Merge",
        href: "/admin/academic-results/settings/syllabus-matrix",
        description: "1st/2nd Paper merge, Credits, 4th Subject config",
        roles: EXAM_FULL,
        legacyRoles: ["admin", "management"],
        keywords: ["syllabus", "paper", "merge", "credit", "fourth subject"],
      },
      {
        kind: "leaf",
        label: "Exam Terms & CT Rules",
        href: "/admin/academic-results/exams",
        description: "Sub-exams, Best-N CT aggregation, Annual term weights",
        roles: EXAM_FULL,
        legacyRoles: ["admin", "management"],
        keywords: ["exam", "term", "ct", "class test", "weight"],
      },
      {
        kind: "leaf",
        label: "Mark Distribution (CQ/MCQ)",
        href: "/admin/academic-results/exams/components",
        description: "CQ, MCQ, Practical, Incourse, Attendance weights & pass bars",
        roles: EXAM_FULL,
        legacyRoles: ["admin", "management"],
        keywords: ["cq", "mcq", "practical", "incourse", "distribution", "pass"],
      },
    ],
  },
  {
    kind: "group",
    label: "Marks Entry Desk",
    icon: FileSpreadsheet,
    roles: ["SUPER_ADMIN", "EXAM_CONTROLLER", "TEACHER"],
    legacyRoles: ["admin", "management", "teacher"],
    children: [
      {
        kind: "leaf",
        label: "Spreadsheet Marks Entry",
        href: "/admin/academic-results/marks-entry",
        description: "Keyboard-first grid for teachers",
        roles: ["SUPER_ADMIN", "EXAM_CONTROLLER", "TEACHER"],
        legacyRoles: ["admin", "management", "teacher"],
        keywords: ["marks", "entry", "spreadsheet", "grid", "input"],
      },
      {
        kind: "leaf",
        label: "CT / Incourse & Attendance",
        href: "/admin/academic-results/marks-entry/auto-sync",
        description: "Auto-pull attendance slabs & CT averages",
        roles: ["SUPER_ADMIN", "EXAM_CONTROLLER", "TEACHER"],
        legacyRoles: ["admin", "management", "teacher"],
        keywords: ["ct", "incourse", "attendance", "sync", "average"],
      },
      {
        kind: "leaf",
        label: "Bulk CSV / OMR Import",
        href: "/admin/academic-results/marks-entry/import",
        description: "Excel & OMR scanner upload",
        roles: ["SUPER_ADMIN", "EXAM_CONTROLLER", "TEACHER"],
        legacyRoles: ["admin", "management", "teacher"],
        keywords: ["csv", "omr", "import", "bulk", "excel", "upload"],
      },
      {
        kind: "leaf",
        label: "Marks Submission Tracker",
        href: "/admin/academic-results/marks-entry/tracker",
        description: "Pending vs. submitted teacher status",
        roles: ["SUPER_ADMIN", "EXAM_CONTROLLER", "TEACHER"],
        legacyRoles: ["admin", "management", "teacher"],
        keywords: ["tracker", "submission", "pending", "status"],
      },
    ],
  },
  {
    kind: "leaf",
    label: "Generate & Publish Result",
    href: "/admin/academic-results/process",
    description: "Result processing engine",
    icon: Cpu,
    roles: EXAM_FULL,
    legacyRoles: ["admin", "management"],
    keywords: ["generate", "process", "publish", "result", "compute"],
  },
  {
    kind: "group",
    label: "Marksheets & Reports",
    icon: Award,
    roles: ["SUPER_ADMIN", "PRINCIPAL", "EXAM_CONTROLLER", "TEACHER"],
    legacyRoles: ["admin", "management", "teacher"],
    children: [
      {
        kind: "leaf",
        label: "Student Marksheets (A4)",
        href: "/admin/academic-results/outputs/marksheets",
        description: "Progress reports & transcripts with QR",
        roles: ["SUPER_ADMIN", "PRINCIPAL", "EXAM_CONTROLLER", "TEACHER"],
        legacyRoles: ["admin", "management", "teacher"],
        keywords: ["marksheet", "transcript", "report card", "qr"],
      },
      {
        kind: "leaf",
        label: "Master Tabulation Sheet",
        href: "/admin/academic-results/outputs/tabulation-sheet",
        description: "A3/Legal landscape broadsheet",
        roles: ["SUPER_ADMIN", "PRINCIPAL", "EXAM_CONTROLLER", "TEACHER"],
        legacyRoles: ["admin", "management", "teacher"],
        keywords: ["tabulation", "broadsheet", "master", "tab"],
      },
      {
        kind: "leaf",
        label: "Merit & Fail List",
        href: "/admin/academic-results/outputs/merit-list",
        description: "Section/Class/Shift merit & unpromoted list",
        roles: ["SUPER_ADMIN", "PRINCIPAL", "EXAM_CONTROLLER", "TEACHER"],
        legacyRoles: ["admin", "management", "teacher"],
        keywords: ["merit", "fail", "rank", "unpromoted", "pass"],
      },
      {
        kind: "leaf",
        label: "Subject & Teacher Analytics",
        href: "/admin/academic-results/outputs/analytics",
        description: "Pass % and grade distribution histogram",
        roles: ["SUPER_ADMIN", "PRINCIPAL", "EXAM_CONTROLLER", "TEACHER"],
        legacyRoles: ["admin", "management", "teacher"],
        keywords: ["analytics", "statistics", "pass rate", "histogram", "distribution"],
      },
    ],
  },

  /* ── Core sections (existing routes preserved, flattened to 2 levels) ── */
  { kind: "section", label: "Academics & Students" },
  {
    kind: "group",
    label: "Academics",
    icon: GraduationCap,
    roles: ALL,
    legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"],
    children: [
      { kind: "leaf", label: "Class Schedule", href: "/admin/academic/class-schedule", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Academic Rules", href: "/admin/academic/academic-rules", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Calendar", href: "/admin/academic/calendar", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Attendance", href: "/admin/academic/attendance", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Leave Info", href: "/admin/academic/leave-info", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Staffs", href: "/admin/academic/staffs", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
    ],
  },
  {
    kind: "group",
    label: "Students",
    icon: Users,
    roles: ALL,
    legacyRoles: ["admin", "management", "teacher"],
    children: [
      { kind: "leaf", label: "Student List", href: "/admin/students", roles: ["SUPER_ADMIN", "PRINCIPAL", "EXAM_CONTROLLER", "TEACHER"], legacyRoles: ["admin", "management", "teacher"] },
      { kind: "leaf", label: "Teachers", href: "/admin/teachers", roles: ["SUPER_ADMIN", "PRINCIPAL"], legacyRoles: ["admin", "management"] },
      { kind: "leaf", label: "Exam Schedule", href: "/admin/student/exam-schedule", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Exam System", href: "/admin/student/exam-system", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Daily Activities", href: "/admin/student/daily-activities", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Rules", href: "/admin/student/rules", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Uniform", href: "/admin/student/uniform", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
    ],
  },
  /* ── Module C: Admission & Enrollment (STUDENT_ADMISSION_PLAN §2/§5) ──
     Document-wise: one sidebar leaf per plan document/phase output.
     5-Step Wizard + onboarding engine live inside their pages (2-level rule). */
  { kind: "section", label: "Admission & Enrollment" },
  {
    kind: "group",
    label: "Admission Desk",
    icon: UserPlus,
    roles: ADMISSION_FULL,
    legacyRoles: FINANCE_LEGACY,
    children: [
      {
        kind: "leaf",
        label: "Admission Dashboard",
        href: "/admin/admissions/dashboard",
        description: "Seats vs admitted, today's admissions, pending fees (Plan §2)",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["admission dashboard", "seats", "capacity", "today"],
      },
      {
        kind: "leaf",
        label: "Campaigns & Circulars",
        href: "/admin/admissions/campaigns",
        description: "Circulars, seat capacity, eligibility rules, form sale",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["campaign", "circular", "seats", "eligibility", "prospectus", "form sale"],
      },
      {
        kind: "leaf",
        label: "Applications Pipeline",
        href: "/admin/admissions/applications",
        description: "Applicant pipeline, test marks, merit & waiting list",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["application", "applicant", "merit", "waiting", "test marks", "shortlist"],
      },
      {
        kind: "leaf",
        label: "Direct Admission Wizard",
        href: "/admin/admissions/direct-admission",
        description: "5-Step wizard: family → student → subjects → waiver → invoice & POS (§4)",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        badge: "5-Step",
        keywords: ["direct admission", "wizard", "onboarding", "sibling", "waiver", "pos", "invoice"],
      },
    ],
  },
  {
    kind: "group",
    label: "Student Registry",
    icon: IdCard,
    roles: ADMISSION_FULL,
    legacyRoles: FINANCE_LEGACY,
    children: [
      {
        kind: "leaf",
        label: "Students Directory",
        href: "/admin/admissions/students",
        description: "Master directory, profile, ID card & admission form print (§3.3/§5)",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["student", "directory", "profile", "id card", "admission form"],
      },
      {
        kind: "leaf",
        label: "Families Directory",
        href: "/admin/admissions/families",
        description: "Parent/guardian master, NID/phone lookup, sibling links (§3.2)",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["family", "parent", "guardian", "sibling", "nid", "phone"],
      },
      {
        kind: "leaf",
        label: "Documents & Verification",
        href: "/admin/admissions/documents",
        description: "Birth cert, NIDs, TC, marksheet & orphan-cert checklist",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["document", "verification", "birth cert", "nid", "tc", "marksheet", "checklist"],
      },
    ],
  },
  {
    kind: "group",
    label: "Enrollment Lifecycle",
    icon: FolderKanban,
    roles: ADMISSION_FULL,
    legacyRoles: FINANCE_LEGACY,
    children: [
      {
        kind: "leaf",
        label: "Enrollments & Sections",
        href: "/admin/admissions/enrollments",
        description: "Roll generator, section transfer, residence & quota tags (§3.4)",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["enrollment", "roll", "section", "transfer", "hostel", "quota"],
      },
      {
        kind: "leaf",
        label: "Promotion & TC Issue",
        href: "/admin/admissions/promotion-tc",
        description: "Session promotion, readmission, TC with dues clearance (§5)",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["promotion", "tc", "transfer certificate", "readmission", "clearance"],
      },
      {
        kind: "leaf",
        label: "Previous Education",
        href: "/admin/admissions/previous-education",
        description: "SSC/Dakhil/HSC history, board GPA, TC trail (§3.3)",
        roles: ADMISSION_FULL,
        legacyRoles: FINANCE_LEGACY,
        keywords: ["previous", "ssc", "dakhil", "hsc", "board", "gpa", "history"],
      },
    ],
  },
  {
    kind: "group",
    label: "Admission Settings",
    icon: ClipboardList,
    roles: ["SUPER_ADMIN", "PRINCIPAL"],
    legacyRoles: ["admin", "management"],
    children: [
      {
        kind: "leaf",
        label: "ID & Roll Formats",
        href: "/admin/admissions/settings/id-formats",
        description: "Student ID + roll sequence builder with row-lock safety (§Phase 1)",
        roles: ["SUPER_ADMIN", "PRINCIPAL"],
        legacyRoles: ["admin", "management"],
        keywords: ["id format", "roll", "sequence", "builder"],
      },
      {
        kind: "leaf",
        label: "Quota & Waiver Presets",
        href: "/admin/admissions/settings/waiver-presets",
        description: "Merit, sibling, freedom-fighter, orphan/Lillah presets (§4)",
        roles: ["SUPER_ADMIN", "PRINCIPAL"],
        legacyRoles: ["admin", "management"],
        keywords: ["quota", "waiver", "preset", "merit", "sibling", "lillah", "scholarship"],
      },
      {
        kind: "leaf",
        label: "Required Documents",
        href: "/admin/admissions/settings/documents",
        description: "Per-class required-document checklist (§2 settings)",
        roles: ["SUPER_ADMIN", "PRINCIPAL"],
        legacyRoles: ["admin", "management"],
        keywords: ["required", "document", "checklist", "settings"],
      },
    ],
  },
  /* ── Website & information (About flattened: was a 3rd level) ── */
  { kind: "section", label: "Website & Information" },
  {
    kind: "group",
    label: "Website Management",
    icon: Globe,
    roles: ["SUPER_ADMIN", "PRINCIPAL"],
    legacyRoles: ["admin", "management"],
    children: [
      { kind: "leaf", label: "Navigation Menu", href: "/admin/website-management/navigation-menu", roles: ["SUPER_ADMIN", "PRINCIPAL"], legacyRoles: ["admin", "management"] },
      { kind: "leaf", label: "Site Settings", href: "/admin/website-management/site-settings", roles: ["SUPER_ADMIN", "PRINCIPAL"], legacyRoles: ["admin", "management"] },
      { kind: "leaf", label: "Hero Section", href: "/admin/website-management/hero-section", roles: ["SUPER_ADMIN", "PRINCIPAL"], legacyRoles: ["admin", "management"], icon: Sparkles },
      { kind: "leaf", label: "Slider", href: "/admin/website-management/sliders", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"], icon: Images },
      { kind: "leaf", label: "Notice Board", href: "/admin/notices", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"], icon: Megaphone },
      { kind: "leaf", label: "About Us", href: "/admin/website-management/about-us", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"], icon: Info },
      { kind: "leaf", label: "History", href: "/admin/website-management/history", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"], icon: History },
      { kind: "leaf", label: "Chairman Speech", href: "/admin/website-management/chairman-speech", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Principal Speech", href: "/admin/website-management/principal-speech", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Governing Body", href: "/admin/website-management/governing-body", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Ex-Principals", href: "/admin/website-management/ex-principals", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Website Teachers", href: "/admin/website-management/teachers", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Staff Information", href: "/admin/website-management/staff", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
    ],
  },
  {
    kind: "group",
    label: "Information",
    icon: Info,
    roles: ALL,
    legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"],
    children: [
      { kind: "leaf", label: "Permission & Recognition", href: "/admin/information/permission-recognition-letter", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Nationalization", href: "/admin/information/nationalization", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Statistics Report", href: "/admin/information/statistics-report", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Govt. Approval Letter", href: "/admin/information/govt-approval-letter", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
    ],
  },
  {
    kind: "group",
    label: "Facilities",
    icon: Sparkles,
    roles: ALL,
    legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"],
    children: [
      { kind: "leaf", label: "Library", href: "/admin/facilities/library", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Playground", href: "/admin/facilities/playground", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Physics Lab", href: "/admin/facilities/physics-lab", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Biology Lab", href: "/admin/facilities/biology-lab", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "ICT Lab", href: "/admin/facilities/ict-lab", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Chemistry Lab", href: "/admin/facilities/chemistry-lab", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Extra Activities", href: "/admin/facilities/extra-activities", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
    ],
  },
  {
    kind: "group",
    label: "Others",
    icon: Bell,
    roles: ALL,
    legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"],
    children: [
      { kind: "leaf", label: "News", href: "/admin/others/news", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Gallery", href: "/admin/others/gallery", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Events", href: "/admin/others/event", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"], icon: CalendarDays },
      { kind: "leaf", label: "Routine", href: "/admin/others/routine", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"], icon: CalendarDays },
      { kind: "leaf", label: "Downloads", href: "/admin/others/download", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
    ],
  },

  /* ── System ── */
  { kind: "section", label: "System" },
  {
    kind: "group",
    label: "Account",
    icon: UserCog,
    roles: ALL,
    legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"],
    children: [
      { kind: "leaf", label: "Profile", href: "/admin/profile", roles: ALL, legacyRoles: ["admin", "management", "accountant", "teacher", "student", "guardian"] },
      { kind: "leaf", label: "Settings", href: "/admin/settings", roles: ["SUPER_ADMIN", "PRINCIPAL"], legacyRoles: ["admin", "management"], icon: Settings },
    ],
  },
  {
    kind: "group",
    label: "Permission Management",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN"],
    legacyRoles: ["admin"],
    children: [
      { kind: "leaf", label: "Add Permission", href: "/admin/permission-management/add-permission", roles: ["SUPER_ADMIN"], legacyRoles: ["admin"] },
      { kind: "leaf", label: "Modules", href: "/admin/permission-management/modules", roles: ["SUPER_ADMIN"], legacyRoles: ["admin"] },
      { kind: "leaf", label: "User Permissions", href: "/admin/permission-management/user-permissions", roles: ["SUPER_ADMIN"], legacyRoles: ["admin"] },
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
  return (leaf.matchPaths ?? []).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
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

/** Current mock-gate filter: keeps leaves whose legacyRoles include `role`;
 *  groups survive iff at least one child survives. Sections survive iff a
 *  visible non-section item follows them (resolved by the Sidebar). */
export function filterNavForRole(items: NavItem[], role: Role): NavItem[] {
  // DEV-ONLY testing bypass — remove with DEV_BYPASS_ROLE_FILTER.
  if (DEV_BYPASS_ROLE_FILTER) return items;
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.kind === "section") {
      out.push(item);
      continue;
    }
    if (item.kind === "leaf") {
      if (item.legacyRoles.includes(role)) out.push(item);
      continue;
    }
    const visible = item.children.filter((c) => c.legacyRoles.includes(role));
    if (visible.length > 0) out.push({ ...item, children: visible });
  }
  // Drop trailing sections and sections with no visible item after them.
  const pruned: NavItem[] = [];
  for (let i = 0; i < out.length; i++) {
    const item = out[i];
    if (item.kind !== "section") {
      pruned.push(item);
      continue;
    }
    const hasVisibleAfter = out.slice(i + 1).some((n) => n.kind !== "section");
    if (hasVisibleAfter) pruned.push(item);
  }
  return pruneLeadingSections(pruned);
}

function pruneLeadingSections(items: NavItem[]): NavItem[] {
  let i = 0;
  while (i < items.length && items[i].kind === "section") {
    // A section is only leading if no leaf/group precedes it.
    const hasPreceding = items.slice(0, i).some((n) => n.kind !== "section");
    if (hasPreceding) break;
    // Keep the first leading section only when an item follows it.
    const hasFollowing = items.slice(i + 1).some((n) => n.kind !== "section");
    if (i === 0 && hasFollowing) break;
    i++;
  }
  return items.filter((n, idx) => {
    if (n.kind !== "section") return true;
    if (idx < i) return false;
    const prev = items[idx - 1];
    return !(prev && prev.kind === "section"); // collapse consecutive sections
  });
}

/** Future session-gate filter over canonical `roles`. Groups additionally
 *  require their own `roles` to include `userRole`. */
export function filterNavForUserRole(items: NavItem[], userRole: UserRole): NavItem[] {
  // DEV-ONLY testing bypass — remove with DEV_BYPASS_ROLE_FILTER.
  if (DEV_BYPASS_ROLE_FILTER) return items;
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.kind === "section") {
      out.push(item);
      continue;
    }
    if (item.kind === "leaf") {
      if (item.roles.includes(userRole)) out.push(item);
      continue;
    }
    if (!item.roles.includes(userRole)) continue;
    const visible = item.children.filter((c) => c.roles.includes(userRole));
    if (visible.length > 0) out.push({ ...item, children: visible });
  }
  return out.filter((n, idx, arr) => {
    if (n.kind !== "section") return true;
    const next = arr.slice(idx + 1).find((m) => m.kind !== "section");
    const prev = [...arr.slice(0, idx)].reverse().find((m) => m.kind !== "section");
    return Boolean(next && prev !== undefined);
  });
}

/* ------------------------------------------------------------------ */
/*  Command palette index — flat searchable helper for Ctrl+K. Every   */
/*  leaf is indexed exactly once as "Group › Label" (or bare label for */
/*  top-level links) so the palette jumps to any screen in 1 second.   */
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

/** All leaves, unfiltered (filter by role at the call site). */
export const commandPaletteIndex: NavCommand[] = buildCommandIndex(navItems);

/** Alias kept for consumers expecting a `flatNavIndex` name. */
export const flatNavIndex: NavCommand[] = commandPaletteIndex;

/** Role-scoped palette entries for the current mock session role. */
export function commandIndexForRole(role: Role): NavCommand[] {
  const visible = new Set<string>();
  for (const item of filterNavForRole(navItems, role)) {
    if (item.kind === "leaf") visible.add(item.href);
    else if (item.kind === "group") item.children.forEach((c) => visible.add(c.href));
  }
  return commandPaletteIndex.filter((c) => visible.has(c.href));
}

/** Case-insensitive substring search over label + group + keywords. */
export function searchNav(index: NavCommand[], query: string): NavCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return index;
  return index.filter((c) =>
    `${c.group ?? ""} ${c.label} ${c.keywords.join(" ")}`.toLowerCase().includes(q),
  );
}
