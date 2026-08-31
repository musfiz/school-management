import { getLocale } from "next-intl/server";
import HeroSlider from "@/components/HeroSlider";
import Hero from "@/components/Hero";
import { AboutPreview, NoticeBoard } from "@/components/HomeSections";
import { getSiteSettings } from "@/lib/site-settings";
import type { Locale } from "@/i18n/config";

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  const settings = await getSiteSettings(locale);

  return (
    <>
      <HeroSlider />
      <Hero settings={settings} />
      <AboutPreview settings={settings} />
      <NoticeBoard />
    </>
  );
}
