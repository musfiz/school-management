/**
 * Login-portal variant config.
 *
 * Two visual entry points — `/login` (staff) and `/site/login` (public) — share
 * the same form component, the same API, and the same session cookie. The
 * "soft" split is purely about branding, copy and the header CTA. Both pages
 * accept any of the 5 roles; the role decides what the user sees once they
 * land on /dashboard.
 */

export type LoginVariant = "staff" | "public";

export interface LoginVariantConfig {
  /** Page route the form posts to / navigates after success. */
  loginPath: string;
  /** Other portal's path, for the cross-link. */
  otherPath: string;
  /** Heading above the form. */
  title: string;
  /** Subtitle under the heading. */
  subtitle: string;
  /** Short blurb shown above the form fields. */
  blurb: string;
  /** Label of the cross-link to the other portal. */
  otherLabel: string;
  /** Label used in the header CTA. */
  headerLabel: string;
  /** Intro line inside the demo-accounts <details>. */
  demoIntro: string;
}

export const loginVariants: Record<LoginVariant, LoginVariantConfig> = {
  staff: {
    loginPath: "/login",
    otherPath: "/site/login",
    title: "Sign in",
    subtitle: "Administrator, Management and Teacher accounts",
    blurb:
      "Sign in with the credentials issued by your administrator. Students and parents should use the public sign-in.",
    otherLabel: "Student or parent? Sign in here →",
    headerLabel: "Sign in",
    demoIntro: "Click a row to fill the form. Demo staff accounts:",
  },
  public: {
    loginPath: "/site/login",
    otherPath: "/login",
    title: "Student & parent sign in",
    subtitle: "Student and Guardian accounts",
    blurb:
      "Welcome back. Sign in to view your results, notices, routine and profile. School staff should use the staff sign-in instead.",
    otherLabel: "School staff? Sign in here →",
    headerLabel: "Student / parent sign in",
    demoIntro: "Click a row to fill the form. Demo student/parent accounts:",
  },
};
