/* ----------------------------------------------------------------------------
   Navigation registry — single source of truth for the site menu.
   The Header dropdown and the sitemap are both generated from this.
   `section` + `slug` map to the dynamic route: /[section]/[slug]
   (top-level sections without children use /[section]).
---------------------------------------------------------------------------- */

export interface NavItem {
  label: string;
  href: string;
  section: string; // route segment
  slug?: string; // sub-page segment (omit for index pages)
  description?: string;
  children?: NavItem[];
}

export const mainNav: NavItem[] = [
  { label: "Home", href: "/", section: "home" },

  {
    label: "About",
    href: "/about",
    section: "about",
    children: [
      { label: "About Us", href: "/about/about-us", section: "about", slug: "about-us", description: "Who we are" },
      { label: "History", href: "/about/history", section: "about", slug: "history" },
      { label: "Donor List", href: "/about/donor-list", section: "about", slug: "donor-list" },
      { label: "Mission & Vision", href: "/about/mission-vision", section: "about", slug: "mission-vision" },
      { label: "Campus Tour", href: "/about/campus-tour", section: "about", slug: "campus-tour" },
      { label: "Achievements", href: "/about/achievements", section: "about", slug: "achievements" },
      { label: "Chairman Speech", href: "/about/chairman-speech", section: "about", slug: "chairman-speech" },
      { label: "Governing Body", href: "/about/governing-body", section: "about", slug: "governing-body" },
      { label: "Principal Speech", href: "/about/principal-speech", section: "about", slug: "principal-speech" },
      { label: "Ex-Principals", href: "/about/ex-principals", section: "about", slug: "ex-principals" },
      { label: "Administrators", href: "/about/administrators", section: "about", slug: "administrators" },
    ],
  },

  {
    label: "Information",
    href: "/information",
    section: "information",
    children: [
      { label: "Permission Recognition Letter", href: "/information/permission-recognition-letter", section: "information", slug: "permission-recognition-letter" },
      { label: "Nationalization", href: "/information/nationalization", section: "information", slug: "nationalization" },
      { label: "Statistics Report", href: "/information/statistics-report", section: "information", slug: "statistics-report" },
      { label: "Govt. Approval Letter", href: "/information/govt-approval-letter", section: "information", slug: "govt-approval-letter" },
    ],
  },

  {
    label: "Academic",
    href: "/academic",
    section: "academic",
    children: [
      { label: "Class Schedule", href: "/academic/class-schedule", section: "academic", slug: "class-schedule" },
      { label: "Teachers", href: "/academic/teachers", section: "academic", slug: "teachers" },
      { label: "Staffs", href: "/academic/staffs", section: "academic", slug: "staffs" },
      { label: "Academic Rules", href: "/academic/academic-rules", section: "academic", slug: "academic-rules" },
      { label: "Calendar", href: "/academic/calendar", section: "academic", slug: "calendar" },
      { label: "Attendance", href: "/academic/attendance", section: "academic", slug: "attendance" },
      { label: "Leave Info", href: "/academic/leave-info", section: "academic", slug: "leave-info" },
    ],
  },

  {
    label: "Admission",
    href: "/admission",
    section: "admission",
    children: [
      { label: "Why Study Here", href: "/admission/why-study", section: "admission", slug: "why-study" },
      { label: "How to Apply", href: "/admission/how-to-apply", section: "admission", slug: "how-to-apply" },
      { label: "Admission Test", href: "/admission/admission-test", section: "admission", slug: "admission-test" },
      { label: "Policy", href: "/admission/policy", section: "admission", slug: "policy" },
      { label: "Registration System", href: "/admission/registration-system", section: "admission", slug: "registration-system" },
    ],
  },

  {
    label: "Student",
    href: "/student",
    section: "student",
    children: [
      { label: "Student List", href: "/student/student-list", section: "student", slug: "student-list" },
      { label: "Tuition Fees", href: "/student/tuition-fees", section: "student", slug: "tuition-fees" },
      { label: "Mobile Banking", href: "/student/mobile-banking", section: "student", slug: "mobile-banking" },
      { label: "Daily Activities", href: "/student/daily-activities", section: "student", slug: "daily-activities" },
      { label: "Exam Schedule", href: "/student/exam-schedule", section: "student", slug: "exam-schedule" },
      { label: "Uniform", href: "/student/uniform", section: "student", slug: "uniform" },
      { label: "Exam System", href: "/student/exam-system", section: "student", slug: "exam-system" },
      { label: "Rules", href: "/student/rules", section: "student", slug: "rules" },
    ],
  },

  {
    label: "Facilities",
    href: "/facilities",
    section: "facilities",
    children: [
      { label: "Library", href: "/facilities/library", section: "facilities", slug: "library" },
      { label: "Playground", href: "/facilities/playground", section: "facilities", slug: "playground" },
      { label: "Physics Lab", href: "/facilities/physics-lab", section: "facilities", slug: "physics-lab" },
      { label: "Biology Lab", href: "/facilities/biology-lab", section: "facilities", slug: "biology-lab" },
      { label: "ICT Lab", href: "/facilities/ict-lab", section: "facilities", slug: "ict-lab" },
      { label: "Chemistry Lab", href: "/facilities/chemistry-lab", section: "facilities", slug: "chemistry-lab" },
      { label: "Extra Activities", href: "/facilities/extra-activities", section: "facilities", slug: "extra-activities" },
    ],
  },

  {
    label: "Result",
    href: "/result",
    section: "result",
    children: [
      { label: "Exam Result", href: "/result/exam-result", section: "result", slug: "exam-result" },
      { label: "Academic Result", href: "/result/academic-result", section: "result", slug: "academic-result" },
      { label: "Evaluation Result", href: "/result/evaluation-result", section: "result", slug: "evaluation-result" },
      { label: "Board Exam Result", href: "/result/board-exam-result", section: "result", slug: "board-exam-result" },
    ],
  },

  {
    label: "Others",
    href: "/others",
    section: "others",
    children: [
      { label: "Notice", href: "/others/notice", section: "others", slug: "notice" },
      { label: "News", href: "/others/news", section: "others", slug: "news" },
      { label: "Gallery", href: "/others/gallery", section: "others", slug: "gallery" },
      { label: "Event", href: "/others/event", section: "others", slug: "event" },
      { label: "Routine", href: "/others/routine", section: "others", slug: "routine" },
      { label: "Download", href: "/others/download", section: "others", slug: "download" },
    ],
  },

  { label: "Contact", href: "/contact", section: "contact" },
];

/** Flat list of every route (used by sitemap). */
export const allRoutes: { href: string; section: string; slug?: string; label: string }[] = mainNav.flatMap(
  (item) =>
    item.children
      ? item.children.map((c) => ({ href: c.href, section: c.section, slug: c.slug, label: c.label }))
      : [{ href: item.href, section: item.section, slug: item.slug, label: item.label }],
);

export function findNav(section: string, slug?: string): NavItem | undefined {
  for (const item of mainNav) {
    if (item.section === section && !item.slug && !slug) return item;
    if (item.children) {
      const child = item.children.find((c) => c.section === section && c.slug === slug);
      if (child) return child;
    }
  }
  return undefined;
}
