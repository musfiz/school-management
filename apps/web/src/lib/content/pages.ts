import type { PageDoc } from "./types";

/* ----------------------------------------------------------------------------
   Page content store.
   `pages` holds hand-authored docs for the most important routes.
   `getPage()` falls back to a generated doc for any other registered route so
   that the entire menu renders without a dedicated file per page.
---------------------------------------------------------------------------- */

const pages: Record<string, PageDoc> = {
  "about/about-us": {
    slug: "about-us",
    section: "about",
    title: "About Us",
    description:
      "Model High School is a public secondary school founded in 1972, dedicated to nurturing curious, disciplined and capable citizens.",
    updated: "2026-07-15",
    blocks: [
      {
        type: "prose",
        text: "Model High School was established in 1972 with a simple belief: every child deserves a rigorous, caring education. For over five decades we have served the Model Town community, growing from a single building into a campus of more than 2,400 students guided by 96 dedicated teachers.",
      },
      {
        type: "stats",
        items: [
          { value: "1972", label: "Established" },
          { value: "2,400+", label: "Students" },
          { value: "96", label: "Teachers" },
          { value: "18", label: "Subjects" },
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "What makes us different",
      },
      {
        type: "list",
        items: [
          "Small class sizes and attentive mentoring from every teacher.",
          "A balance of academic rigor, co-curricular life and character education.",
          "Free tuition and need-based support so no student is left behind.",
          "Modern labs, a rich library and a safe, inclusive campus.",
        ],
      },
      {
        type: "callout",
        tone: "gold",
        title: "Our promise",
        text: "We meet every learner where they are — and help them go further than they imagined.",
      },
    ],
  },

  "about/history": {
    slug: "history",
    section: "about",
    title: "History",
    description: "The story of Model High School from 1972 to today.",
    updated: "2026-06-02",
    blocks: [
      {
        type: "prose",
        text: "Founded in 1972 by a group of local educators and philanthropists, Model High School began with 84 students in a rented building. Within a decade, community donations funded our permanent campus on Education Road.",
      },
      {
        type: "cards",
        items: [
          { title: "1972", meta: "Foundation", text: "Opened with 84 students and 6 teachers in a rented hall." },
          { title: "1981", meta: "Permanent campus", text: "Community-funded campus on Education Road was inaugurated." },
          { title: "1998", meta: "Nationalized", text: "Became a government-supported public school." },
          { title: "2015", meta: "Digital campus", text: "ICT lab, smart classrooms and online admissions launched." },
        ],
      },
    ],
  },

  "about/mission-vision": {
    slug: "mission-vision",
    section: "about",
    title: "Mission & Vision",
    description: "Our mission, vision and core values.",
    blocks: [
      {
        type: "cards",
        items: [
          { title: "Mission", text: "Deliver equitable, excellent education that builds knowledge, discipline and character in every student." },
          { title: "Vision", text: "To be a model public school where every learner discovers their potential and contributes to society." },
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Core values",
      },
      {
        type: "list",
        items: [
          "Integrity — we do what is right, even when no one is watching.",
          "Inclusion — every student belongs and is supported.",
          "Excellence — we pursue our best in learning and conduct.",
          "Service — we give back to our community.",
        ],
      },
    ],
  },

  "admission/how-to-apply": {
    slug: "how-to-apply",
    section: "admission",
    title: "How to Apply",
    description: "Step-by-step admission process for the new academic session.",
    blocks: [
      {
        type: "prose",
        text: "Admission to Model High School is open to all eligible students. The process is simple, transparent and free of any donation requirement.",
      },
      {
        type: "cards",
        items: [
          { title: "1. Collect the form", text: "Get the admission form from the school office or download it from the Download section." },
          { title: "2. Submit documents", text: "Return the form with a birth certificate, previous school records and two photos." },
          { title: "3. Admission test", text: "Eligible applicants sit a short written test in English, Mathematics and Bengali." },
          { title: "4. Enroll", text: "Selected students complete enrollment and join their class." },
        ],
      },
      {
        type: "cta",
        title: "Ready to apply?",
        text: "Start your child's journey at Model High School today.",
        href: "/admission/registration-system",
        hrefLabel: "Open registration",
      },
    ],
  },

  "admission/why-study": {
    slug: "why-study",
    section: "admission",
    title: "Why Study Here",
    description: "Reasons families choose Model High School.",
    blocks: [
      {
        type: "list",
        items: [
          "Consistently high pass rates in public board examinations.",
          "Experienced, caring faculty and small classes.",
          "Free tuition with need-based support for uniforms and meals.",
          "A vibrant co-curricular program: sports, clubs, debate and music.",
        ],
      },
      {
        type: "quote",
        text: "Model High School gave my children more than grades — it gave them confidence and community.",
        cite: "— Parent of two alumni",
      },
    ],
  },

  "student/uniform": {
    slug: "uniform",
    section: "student",
    title: "School Uniform",
    description: "Uniform guidelines for students.",
    blocks: [
      {
        type: "list",
        items: [
          "Boys: white shirt, navy trousers, navy sweater (winter), black shoes.",
          "Girls: white frock / navy salwar-kameez, navy scarf, black shoes.",
          "PE days: house-color T-shirt with white shorts / track pants.",
          "Identity card must be worn on campus at all times.",
        ],
      },
    ],
  },

  "student/rules": {
    slug: "rules",
    section: "student",
    title: "Student Rules",
    description: "Code of conduct for students.",
    blocks: [
      {
        type: "list",
        items: [
          "Attend school regularly and arrive before the bell.",
          "Show respect to teachers, staff and fellow students.",
          "Wear the prescribed uniform and carry the ID card.",
          "Use campus facilities responsibly and keep the school clean.",
        ],
      },
    ],
  },

  "facilities/library": {
    slug: "library",
    section: "facilities",
    title: "Library",
    description: "Our well-stocked school library.",
    blocks: [
      {
        type: "prose",
        text: "The school library holds over 12,000 volumes — textbooks, reference works, fiction and periodicals — with a quiet reading hall and a digital catalog.",
      },
      {
        type: "stats",
        items: [
          { value: "12,000+", label: "Books" },
          { value: "40", label: "Seats" },
          { value: "6", label: "Periodicals" },
        ],
      },
    ],
  },

  "result/exam-result": {
    slug: "exam-result",
    section: "result",
    title: "Exam Result",
    description: "Look up your examination result by class and roll.",
    blocks: [
      {
        type: "prose",
        text: "Enter your class and roll number below to view your result. For board examinations use the Board Exam Result page.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Tip",
        text: "Results are published as soon as the examination committee approves them. Check the Notice Board for publication dates.",
      },
    ],
  },
};

/** Section index pages (e.g. /about) get a friendly landing doc. */
const sectionIndexPages: Record<string, PageDoc> = {
  about: {
    slug: "about",
    section: "about",
    title: "About Model High School",
    description: "Learn about our history, mission, people and achievements.",
    blocks: [
      {
        type: "prose",
        text: "Model High School has served its community for over fifty years. Explore our story, our leadership and the values that guide us.",
      },
    ],
  },
  academic: {
    slug: "academic",
    section: "academic",
    title: "Academic Life",
    description: "Schedules, faculty, rules and the academic calendar.",
    blocks: [
      {
        type: "prose",
        text: "Our academic program balances strong foundations with exploration — from the classroom to the laboratory and beyond.",
      },
    ],
  },
  facilities: {
    slug: "facilities",
    section: "facilities",
    title: "Campus Facilities",
    description: "Library, labs, playground and more.",
    blocks: [
      {
        type: "prose",
        text: "A safe, well-resourced campus supports learning at every level.",
      },
    ],
  },
};

const defaultBody: PageDoc["blocks"] = [
  {
    type: "prose",
    text: "This page provides information for students, parents and the wider community. Content is maintained by the school office and updated regularly.",
  },
  {
    type: "callout",
    tone: "info",
    title: "Need this information?",
    text: "If you cannot find what you need, please contact the school office using the details in the footer.",
  },
];

export function getPage(section: string, slug?: string): PageDoc {
  const key = slug ? `${section}/${slug}` : section;
  if (pages[key]) return pages[key];
  if (!slug && sectionIndexPages[section]) return sectionIndexPages[section];

  // Smart fallback so every registered route renders.
  const label = slug
    ? slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : section.charAt(0).toUpperCase() + section.slice(1);
  return {
    slug: slug ?? section,
    section,
    title: label,
    description: `${label} — information from Model High School.`,
    blocks: defaultBody,
  };
}
