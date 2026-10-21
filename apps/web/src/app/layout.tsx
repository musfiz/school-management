import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import { site } from "@/lib/site";
import { organizationJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/ui";

// Dashboard font — self-hosted via next/font (no runtime request to Google).
// Exposed as a CSS variable so globals.css can scope it to .dashboard-font.
// Weights cover the dashboard usage: 400 body, 500/600 labels/badges, 700 bold.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  keywords: [
    "school",
    "Model High School",
    "admission",
    "results",
    "notice",
    "secondary school",
    "education",
  ],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: site.url,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`lang-${locale} ${roboto.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <JsonLd data={organizationJsonLd()} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
