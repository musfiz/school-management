import type {
  DownloadItem,
  EventItem,
  GalleryImage,
  NewsItem,
  Notice,
  ResultRow,
  Staff,
  Teacher,
} from "./types";

/* Sample data for collections. In production these would come from a CMS /
   database; the shapes are typed so the UI never breaks. */

export const teachers: Teacher[] = [
  {
    id: "t1",
    name: "Dr. A. Rahman",
    designation: "Principal",
    department: "Administration",
    status: "current",
    education: "Ph.D. in Education, University of Dhaka",
    bio: "Leads the school with a focus on inclusive, evidence-based teaching.",
    joined: "2014",
    email: "principal@modelhighschool.edu",
  },
  {
    id: "t2",
    name: "Mrs. F. Begum",
    designation: "Vice Principal",
    department: "Administration",
    status: "current",
    education: "M.Ed., University of Dhaka",
    joined: "2009",
  },
  {
    id: "t3",
    name: "Mr. K. Hossain",
    designation: "Senior Teacher (Physics)",
    department: "Science",
    status: "current",
    education: "M.Sc. Physics",
    joined: "2003",
  },
  {
    id: "t4",
    name: "Ms. N. Akter",
    designation: "Teacher (English)",
    department: "Languages",
    status: "current",
    education: "M.A. English",
    joined: "2011",
  },
  {
    id: "t5",
    name: "Mr. S. Islam",
    designation: "Teacher (Mathematics)",
    department: "Mathematics",
    status: "current",
    education: "M.Sc. Mathematics",
    joined: "2016",
  },
  {
    id: "t6",
    name: "Mr. M. Ali",
    designation: "Head Teacher (Retired)",
    department: "Administration",
    status: "former",
    education: "M.Ed.",
    joined: "1985",
  },
];

export const staff: Staff[] = [
  { id: "s1", name: "Mr. R. Mia", role: "Office Assistant", department: "Admin", status: "current" },
  { id: "s2", name: "Mrs. L. Khatun", role: "Librarian", department: "Library", status: "current" },
  { id: "s3", name: "Mr. J. Uddin", role: "Lab Attendant", department: "Science", status: "current" },
  { id: "s4", name: "Mr. H. Sheikh", role: "Security In-charge", department: "Security", status: "current" },
  { id: "s5", name: "Ms. P. Das", role: "Accountant (Retired)", department: "Accounts", status: "former" },
];

export const notices: Notice[] = [
  {
    id: "n1",
    title: "Admission test for the new session will be held on 10 November 2026",
    date: "2026-08-20",
    category: "Admission",
    pinned: true,
    body: "The admission test for class VI–IX will be held on 10 November 2026 at 10:00 AM. Admit cards will be distributed from the school office three days prior.",
  },
  {
    id: "n2",
    title: "Half-yearly examination routine published",
    date: "2026-08-12",
    category: "Examination",
    body: "The half-yearly examination will begin on 1 September 2026. The full routine is available on the Routine page and the Download section.",
  },
  {
    id: "n3",
    title: "School reopens after summer break on 1 September 2026",
    date: "2026-08-05",
    category: "General",
    body: "Classes for the second term begin on 1 September 2026. Students must report in full uniform.",
  },
  {
    id: "n4",
    title: "Annual sports day scheduled for 15 December 2026",
    date: "2026-07-28",
    category: "Event",
    body: "Our annual sports day will be held on the school playground. Parents are cordially invited.",
  },
];

export const news: NewsItem[] = [
  {
    id: "ne1",
    title: "Model High School debaters win regional championship",
    date: "2026-08-10",
    excerpt: "Our debate team secured first place at the inter-school championship.",
    body: "The Model High School debate team won the regional inter-school championship, defeating 24 schools. Congratulations to the students and their coach.",
  },
  {
    id: "ne2",
    title: "Science fair showcases student inventions",
    date: "2026-07-15",
    excerpt: "Students presented 40 projects at the annual science fair.",
    body: "From a low-cost water purifier to a smart attendance system, students demonstrated creativity and engineering skill at the annual science fair.",
  },
];

export const gallery: GalleryImage[] = [
  { id: "g1", title: "Annual Prize Giving", src: "https://picsum.photos/seed/mhs1/800/600", alt: "Students receiving awards on stage", category: "Events" },
  { id: "g2", title: "Science Lab", src: "https://picsum.photos/seed/mhs2/800/600", alt: "Students working in the physics lab", category: "Facilities" },
  { id: "g3", title: "Library", src: "https://picsum.photos/seed/mhs3/800/600", alt: "Quiet reading hall in the library", category: "Facilities" },
  { id: "g4", title: "Sports Day", src: "https://picsum.photos/seed/mhs4/800/600", alt: "Students on the playground during sports day", category: "Events" },
  { id: "g5", title: "Classroom", src: "https://picsum.photos/seed/mhs5/800/600", alt: "A bright, modern classroom", category: "Campus" },
  { id: "g6", title: "Morning Assembly", src: "https://picsum.photos/seed/mhs6/800/600", alt: "Students at morning assembly", category: "Campus" },
];

export const events: EventItem[] = [
  {
    id: "e1",
    title: "Annual Sports Day",
    date: "2026-12-15",
    venue: "School Playground",
    description: "Track and field events, house competitions and prize distribution.",
  },
  {
    id: "e2",
    title: "Parent-Teacher Meeting",
    date: "2026-09-20",
    venue: "School Auditorium",
    description: "Discuss your child's progress with their class teachers.",
  },
];

export const downloads: DownloadItem[] = [
  { id: "d1", title: "Admission Form 2026", category: "Admission", format: "PDF", size: "240 KB", url: "#", updated: "2026-08-01" },
  { id: "d2", title: "Examination Routine (Half-yearly)", category: "Examination", format: "PDF", size: "180 KB", url: "#", updated: "2026-08-12" },
  { id: "d3", title: "School Calendar 2026", category: "General", format: "PDF", size: "320 KB", url: "#", updated: "2026-01-10" },
  { id: "d4", title: "Result Summary Sheet", category: "Result", format: "XLS", size: "90 KB", url: "#", updated: "2026-07-30" },
];

/* Deterministic sample result set (no external API needed). */
export const results: ResultRow[] = Array.from({ length: 120 }, (_, i) => {
  const gpa = Number((3.0 + (i % 20) * 0.1).toFixed(2));
  const grade = gpa >= 5 ? "A+" : gpa >= 4 ? "A" : gpa >= 3.5 ? "A-" : gpa >= 3 ? "B" : "C";
  return {
    id: i + 1,
    name: `Student ${i + 1}`,
    class: ["VI", "VII", "VIII", "IX", "X"][i % 5],
    roll: 1001 + i,
    gpa,
    grade,
    year: 2026,
  };
});

export function findResult(cls: string, roll: number): ResultRow | undefined {
  return results.find((r) => r.class === cls && r.roll === roll);
}
