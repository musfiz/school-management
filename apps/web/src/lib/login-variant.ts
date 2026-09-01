/**
 * Login-portal variant config.
 *
 * Two visual entry points — `/login` (staff) and `/site/login` (public) — share
 * the same form component, the same API, and the same session cookie. The
 * "soft" split is purely about branding, copy and the cross-link. Both pages
 * accept any of the 5 roles; the role decides what the user sees once they
 * land on /admin.
 */

export type LoginVariant = "staff" | "public";

export interface LoginVariantConfig {
  /** Other portal's path, for the cross-link. */
  otherPath: string;
  /** Short blurb shown above the form fields. */
  blurb: string;
  /** Label of the cross-link to the other portal. */
  otherLabel: string;
}

export const loginVariants: Record<LoginVariant, LoginVariantConfig> = {
  staff: {
    otherPath: "/site/login",
    blurb: "Sign in with the credentials issued by your administrator.",
    otherLabel: "Student or parent? Sign in here →",
  },
  public: {
    otherPath: "/login",
    blurb: "Sign in to view your results, notices, routine and profile.",
    otherLabel: "School staff? Sign in here →",
  },
};
