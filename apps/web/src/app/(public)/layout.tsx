import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NoticeTicker from "@/components/NoticeTicker";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col font-sans antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-navy-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Header />
      <NoticeTicker />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
