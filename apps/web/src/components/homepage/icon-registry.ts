import type { ComponentType, SVGProps } from "react";
import {
  BookIcon,
  CheckIcon,
  FlaskIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  PaletteIcon,
  ShieldIcon,
  SparkIcon,
  StarIcon,
  TargetIcon,
  UsersIcon,
} from "@/components/icons";

/**
 * Icon slot registry for dashboard-managed homepage items.
 *
 * `homepage_items.icon` stores a short token ("book-open", "shield", …) rather
 * than an icon URL or component name, so a typo from the CMS can only ever
 * fall back to a neutral glyph — never an unstyled box or an arbitrary
 * network request. Add a token here to give admins another choice.
 */
const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  book: BookIcon,
  "book-open": BookIcon,
  flask: FlaskIcon,
  globe: GlobeIcon,
  heart: HeartIcon,
  palette: PaletteIcon,
  shield: ShieldIcon,
  sparkles: SparkIcon,
  star: StarIcon,
  target: TargetIcon,
  graduation: GraduationCapIcon,
  people: UsersIcon,
  check: CheckIcon,
};

/** Resolves an icon token to a component, falling back to the neutral spark. */
export function homepageIcon(token: string | null | undefined) {
  if (!token) return SparkIcon;
  return ICONS[token.trim().toLowerCase()] ?? SparkIcon;
}

/** The token list, for the dashboard editor's icon picker. */
export const HOMEPAGE_ICON_TOKENS = Object.keys(ICONS);