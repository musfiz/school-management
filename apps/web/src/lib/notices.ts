export interface NoticeItem {
  id: number;
  title: string;
  titleBn?: string | null;
  slug?: string | null;
  category: string;
  shortDescription?: string | null;
  shortDescriptionBn?: string | null;
  description?: string | null;
  descriptionBn?: string | null;
  imageUrl?: string | null;
  pdfUrl?: string | null;
  isPinned: boolean;
  isActive: boolean;
  publishDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const NOTICE_CATEGORIES = [
  "General",
  "Academic",
  "Examination",
  "Admission",
  "Event",
  "Holiday",
  "Administrative",
] as const;

export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];
