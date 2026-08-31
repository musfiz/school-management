import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Resolves the active locale from a cookie (no `[locale]` URL segment —
 * see docs/i18n-plan.md for why a cookie-based approach was chosen to
 * avoid restructuring every existing route).
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = raw === "bn" ? "bn" : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
