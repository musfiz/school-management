import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { site } from "@/lib/site";
import { FacebookIcon, LinkedinIcon, XIconBrand, YoutubeIcon } from "./icons";

const quickLinks = [
  { label: "About Us", href: "/about/about-us" },
  { label: "Academic", href: "/academic" },
  { label: "Admission", href: "/admission" },
  { label: "Exam Result", href: "/result/exam-result" },
  { label: "Notice", href: "/others/notice" },
  { label: "Contact", href: "/contact" },
];

const socials = [
  { label: "Facebook", href: site.facebook, Icon: FacebookIcon },
  { label: "X", href: site.twitter, Icon: XIconBrand },
  { label: "LinkedIn", href: site.linkedin, Icon: LinkedinIcon },
  { label: "YouTube", href: site.youtube, Icon: YoutubeIcon },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-ink-200 bg-navy-900 text-ink-200">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        {/* Brand */}
        <div>
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt={`${site.name} logo`}
              width={48}
              height={48}
              className="h-12 w-12 rounded-sm"
            />
            <span className="font-display text-base font-extrabold text-white">
              {site.name}
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-300">
            {site.description}
          </p>
          <ul className="mt-5 flex items-center gap-3">
            {socials.map(({ label, href, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/15 text-ink-200 transition-colors hover:border-gold-400 hover:text-gold-300"
                >
                  <Icon className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick links */}
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Quick Links
          </h3>
          <ul className="mt-4 grid grid-cols-2 gap-2.5">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-ink-300 transition-colors hover:text-gold-300"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Contact
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-ink-300">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
              <span>{site.address}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-gold-300" />
              <a href={`tel:${site.phone}`} className="hover:text-gold-300">
                {site.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-gold-300" />
              <a href={`mailto:${site.email}`} className="hover:text-gold-300">
                {site.email}
              </a>
            </li>
            <li className="text-xs text-ink-400">
              EIIN: {site.eiin} · Est. {site.established}
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-400 sm:flex-row sm:px-6">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <p>Built with Next.js &amp; Tailwind CSS.</p>
        </div>
      </div>
    </footer>
  );
}
