"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Mail, Menu, Phone, X } from "lucide-react";
import { mainNav } from "@/lib/navigation";
import { site } from "@/lib/site";
import { FacebookIcon, LinkedinIcon, XIconBrand, YoutubeIcon } from "./icons";

const socials = [
  { label: "Facebook", href: site.facebook, Icon: FacebookIcon },
  { label: "X", href: site.twitter, Icon: XIconBrand },
  { label: "LinkedIn", href: site.linkedin, Icon: LinkedinIcon },
  { label: "YouTube", href: site.youtube, Icon: YoutubeIcon },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "bn">("en");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const noticeHref = "/others/notice";

  return (
    <header>
      {/* ── Tier 1: top utility bar ─────────────────────────────────────── */}
      <div className="bg-navy-900 text-navy-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-xs sm:px-6">
          {/* contact info */}
          <div className="flex items-center gap-4">
            <a
              href={`mailto:${site.email}`}
              className="flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{site.email}</span>
              <span className="sm:hidden">Email</span>
            </a>
            <a
              href={`tel:${site.phone.replace(/\s|-/g, "")}`}
              className="flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{site.phone}</span>
            </a>
          </div>

          {/* social + language + apply */}
          <div className="flex items-center gap-3">
            <ul className="flex items-center gap-2">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="transition-colors hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>

            <div
              className="flex items-center rounded-full border border-navy-700 p-0.5 text-[11px] font-semibold"
              role="group"
              aria-label="Language"
            >
              <button
                type="button"
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                className={`rounded-full px-2 py-0.5 transition-colors ${
                  lang === "en" ? "bg-white text-navy-900" : "text-navy-200 hover:text-white"
                }`}
              >
                EN
              </button>
              <span className="px-0.5 text-navy-600">|</span>
              <button
                type="button"
                onClick={() => setLang("bn")}
                aria-pressed={lang === "bn"}
                className={`rounded-full px-2 py-0.5 transition-colors ${
                  lang === "bn" ? "bg-white text-navy-900" : "text-navy-200 hover:text-white"
                }`}
              >
                বাং
              </button>
            </div>

            <Link
              href="/admission/how-to-apply"
              className="rounded-full bg-gold-500 px-3 py-1 text-xs font-semibold text-navy-900 transition-colors hover:bg-gold-400"
            >
              Online Apply
            </Link>
          </div>
        </div>
      </div>

      {/* ── Tier 2: logo + name + address ──────────────────────────────── */}
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          {/* School logo (400x400 source) */}
          <Link href="/" aria-label={`${site.name} home`} className="shrink-0">
            <Image
              src="/logo.svg"
              alt={`${site.name} logo`}
              width={80}
              height={80}
              priority
              className="h-16 w-16 rounded-full sm:h-20 sm:w-20"
            />
          </Link>

          {/* Name + EST. year + address rows */}
          <div className="min-w-0">
            <Link href="/" className="block">
              <h1 className="font-display text-xl font-extrabold leading-none text-navy-900 sm:text-2xl">
                {site.name}
              </h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gold-600 sm:text-sm">
                Est. {site.established}
              </p>
              <p className="mt-1 text-sm leading-none text-navy-600 sm:text-base">
                {site.tagline}
              </p>
            </Link>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500 sm:text-sm">
              <Phone className="h-3.5 w-3.5 shrink-0 text-ink-400" />
              <span className="truncate">{site.address}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Tier 3: primary navigation (sticky) ────────────────────────── */}
      <div className="sticky top-0 z-50 border-b border-navy-900 bg-navy-800 shadow-soft">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Desktop nav */}
          <nav className="hidden items-center lg:flex" aria-label="Primary">
            <ul className="flex items-center">
              {mainNav.map((item) => (
                <li key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    className={`flex items-center gap-1 px-3 py-3 text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-navy-900 text-white"
                        : "text-navy-100 hover:bg-navy-700 hover:text-white"
                    }`}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                    {item.children && <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
                  </Link>

                  {item.children && (
                    <div className="invisible absolute left-0 top-full z-50 w-64 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      <ul className="overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 shadow-card">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                                isActive(child.href)
                                  ? "bg-navy-50 font-semibold text-navy-800"
                                  : "text-ink-700 hover:bg-ink-100"
                              }`}
                              aria-current={isActive(child.href) ? "page" : undefined}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}

              {/* Last item: Notice */}
              <li>
                <Link
                  href={noticeHref}
                  className={`flex items-center gap-1 px-3 py-3 text-sm font-medium transition-colors ${
                    isActive(noticeHref)
                      ? "bg-navy-900 text-white"
                      : "text-navy-100 hover:bg-navy-700 hover:text-white"
                  }`}
                  aria-current={isActive(noticeHref) ? "page" : undefined}
                >
                  Notice
                </Link>
              </li>
            </ul>
          </nav>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-navy-100 hover:bg-navy-700 lg:hidden"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile accordion */}
        {mobileOpen && (
          <div className="max-h-[80vh] overflow-y-auto border-t border-navy-700 bg-navy-800 lg:hidden">
            <nav className="mx-auto max-w-7xl px-4 py-3 sm:px-6" aria-label="Mobile">
              <ul className="space-y-1">
                {mainNav.map((item) => (
                  <li key={item.href}>
                    {item.children ? (
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenAccordion((cur) => (cur === item.label ? null : item.label))
                          }
                          aria-expanded={openAccordion === item.label}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-navy-50 hover:bg-navy-700"
                        >
                          {item.label}
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              openAccordion === item.label ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {openAccordion === item.label && (
                          <ul className="ml-3 border-l border-navy-600 pl-2">
                            {item.children.map((child) => (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={() => setMobileOpen(false)}
                                  className={`block rounded-lg px-3 py-2 text-sm ${
                                    isActive(child.href)
                                      ? "bg-navy-900 font-semibold text-white"
                                      : "text-navy-100"
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                          isActive(item.href) ? "bg-navy-900 font-semibold text-white" : "text-navy-50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
                <li>
                  <Link
                    href={noticeHref}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive(noticeHref) ? "bg-navy-900 font-semibold text-white" : "text-navy-50"
                    }`}
                  >
                    Notice
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
