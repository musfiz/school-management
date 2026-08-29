/* ----------------------------------------------------------------------------
   Content type system
   Static pages are described by a `PageDoc` with an ordered list of `Block`s.
   Collections (teachers, notices, results, etc.) store typed records.
---------------------------------------------------------------------------- */

export type Block =
  | { type: "prose"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "callout"; tone: "info" | "success" | "gold"; title: string; text: string }
  | { type: "stats"; items: { value: string; label: string }[] }
  | {
      type: "cards";
      items: { title: string; text: string; meta?: string }[];
    }
  | { type: "quote"; text: string; cite?: string }
  | { type: "gallery"; images: { src: string; alt: string }[] }
  | { type: "cta"; title: string; text: string; href: string; hrefLabel: string };

export interface PageDoc {
  slug: string;
  section: string;
  title: string;
  description: string;
  updated?: string;
  blocks: Block[];
}

/* ---- Collection record types ---- */

export interface Teacher {
  id: string;
  name: string;
  designation: string;
  department: string;
  status: "current" | "former";
  education?: string;
  bio?: string;
  joined?: string;
  email?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  department: string;
  status: "current" | "former";
}

export interface Notice {
  id: string;
  title: string;
  date: string; // ISO
  category: string;
  body: string;
  pinned?: boolean;
  attachment?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  body: string;
}

export interface GalleryImage {
  id: string;
  title: string;
  src: string;
  alt: string;
  category: string;
}

export interface EventItem {
  id: string;
  title: string;
  date: string;
  venue: string;
  description: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  category: string;
  format: "PDF" | "DOC" | "XLS";
  size: string;
  url: string;
  updated: string;
}

export interface ResultRow {
  id: number;
  name: string;
  class: string;
  roll: number;
  gpa: number;
  grade: string;
  year: number;
}
