import HeroSlider from "@/components/HeroSlider";
import Hero from "@/components/Hero";
import { AboutPreview, NoticeBoard } from "@/components/HomeSections";

export default function Home() {
  return (
    <>
      <HeroSlider />
      <Hero />
      <AboutPreview />
      <NoticeBoard />
    </>
  );
}
