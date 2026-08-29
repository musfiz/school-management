import { site } from "./site";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "School",
    name: site.name,
    url: site.url,
    description: site.description,
    telephone: site.phone,
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address,
      addressCountry: "BD",
    },
    foundingDate: String(site.established),
  };
}

export function breadcrumbJsonLd(items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${site.url}${item.href}`,
    })),
  };
}

export function articleJsonLd(opts: {
  title: string;
  description: string;
  url: string;
  datePublished?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url: `${site.url}${opts.url}`,
    publisher: { "@type": "Organization", name: site.name },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
  };
}
