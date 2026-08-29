import type { Role } from "./dashboard-nav";

/**
 * Per-role content for the dashboard overview.
 * Kept in one file so the page component stays thin and the data is easy
 * to swap (e.g. from a backend later) without touching layout code.
 */

export interface StatItem {
  value: string;
  label: string;
}

export interface QuickLink {
  label: string;
  href: string;
}

export interface RoleOverview {
  greeting: string;
  subtitle: string;
  stats: StatItem[];
  quickActions: QuickLink[];
}

export const overviewByRole: Record<Role, RoleOverview> = {
  admin: {
    greeting: "Administrator console",
    subtitle: "Manage users, settings, and the full school portal.",
    stats: [
      { value: "2,400", label: "Students" },
      { value: "96", label: "Teachers" },
      { value: "312", label: "Active users" },
      { value: "12", label: "Open notices" },
    ],
    quickActions: [
      { label: "Manage users", href: "/dashboard/settings" },
      { label: "Publish notice", href: "/dashboard/notices" },
      { label: "Review results", href: "/dashboard/results" },
      { label: "School settings", href: "/dashboard/settings" },
    ],
  },
  management: {
    greeting: "Management overview",
    subtitle: "Academic performance, staff, and institutional reports.",
    stats: [
      { value: "98%", label: "Attendance" },
      { value: "87%", label: "Pass rate" },
      { value: "96", label: "Teachers" },
      { value: "5", label: "Pending reports" },
    ],
    quickActions: [
      { label: "Teacher roster", href: "/dashboard/teachers" },
      { label: "Results review", href: "/dashboard/results" },
      { label: "Notices", href: "/dashboard/notices" },
    ],
  },
  teacher: {
    greeting: "Teacher workspace",
    subtitle: "Your classes, attendance, and student results.",
    stats: [
      { value: "5", label: "Classes today" },
      { value: "124", label: "Students" },
      { value: "92%", label: "Today's attendance" },
      { value: "3", label: "Results to enter" },
    ],
    quickActions: [
      { label: "My students", href: "/dashboard/students" },
      { label: "Enter results", href: "/dashboard/results" },
      { label: "Post notice", href: "/dashboard/notices" },
    ],
  },
  student: {
    greeting: "Student portal",
    subtitle: "Your profile, results, routine and notices.",
    stats: [
      { value: "CGPA 4.85", label: "Current GPA" },
      { value: "98%", label: "Attendance" },
      { value: "3", label: "Upcoming exams" },
      { value: "7", label: "New notices" },
    ],
    quickActions: [
      { label: "View results", href: "/dashboard/results" },
      { label: "Notices", href: "/dashboard/notices" },
      { label: "My profile", href: "/dashboard/profile" },
    ],
  },
  guardian: {
    greeting: "Guardian overview",
    subtitle: "Track your child's progress, fees and notices.",
    stats: [
      { value: "98%", label: "Attendance" },
      { value: "CGPA 4.85", label: "Latest GPA" },
      { value: "৳0", label: "Outstanding fees" },
      { value: "2", label: "New notices" },
    ],
    quickActions: [
      { label: "Child's results", href: "/dashboard/results" },
      { label: "Notices", href: "/dashboard/notices" },
      { label: "Profile", href: "/dashboard/profile" },
    ],
  },
};
