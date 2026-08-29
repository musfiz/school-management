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

export interface DashNavItem {
  label: string;
  href: string;
  /** Which roles can see this nav entry. */
  roles: Role[];
  icon: "home" | "users" | "teacher" | "result" | "notice" | "profile" | "settings";
}

export const dashboardNav: DashNavItem[] = [
  { label: "Overview", href: "/dashboard", roles: ROLES, icon: "home" },
  { label: "Students", href: "/dashboard/students", roles: ["admin", "management", "teacher"], icon: "users" },
  { label: "Teachers", href: "/dashboard/teachers", roles: ["admin", "management"], icon: "teacher" },
  { label: "Results", href: "/dashboard/results", roles: ["admin", "management", "teacher", "student", "guardian"], icon: "result" },
  { label: "Notices", href: "/dashboard/notices", roles: ROLES, icon: "notice" },
  { label: "Profile", href: "/dashboard/profile", roles: ROLES, icon: "profile" },
  { label: "Settings", href: "/dashboard/settings", roles: ["admin", "management"], icon: "settings" },
];
