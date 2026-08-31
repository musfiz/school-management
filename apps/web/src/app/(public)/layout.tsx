import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NoticeTicker from "@/components/NoticeTicker";
import { getLocale } from "next-intl/server";
import { getHeaderNav } from "@/lib/menus";
import { getSiteSettings } from "@/lib/site-settings";
import type { Locale } from "@/i18n/config";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const [navItems, settings] = await Promise.all([getHeaderNav(), getSiteSettings(locale)]);

  return (
    <div className="flex min-h-screen flex-col font-sans antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-navy-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Header navItems={navItems} settings={settings} />
      <NoticeTicker />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer settings={settings} />
    </div>
  );
}
