/* ----------------------------------------------------------------------------
   Dashboard role model.
   Single source of truth for the dashboard role definitions and labels.
---------------------------------------------------------------------------- */

export type Role = "admin" | "management" | "accountant" | "teacher" | "student" | "guardian";

export const ROLES: Role[] = [
  "admin",
  "management",
  "accountant",
  "teacher",
  "student",
  "guardian",
];

export const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  management: "Management",
  accountant: "Accountant",
  teacher: "Teacher",
  student: "Student",
  guardian: "Guardian",
};

export const roleDescriptions: Record<Role, string> = {
  admin: "Full control over the school portal, users and settings.",
  management: "Oversee academics, staff and institutional reporting.",
  accountant: "Handle vouchers, billing, collections and accounting reports.",
  teacher: "Manage classes, students, attendance and results.",
  student: "View your profile, results, routine and notices.",
  guardian: "Track your child's progress, fees and notices.",
};
