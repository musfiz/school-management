import type { MetadataRoute } from "next";
import { allRoutes } from "@/lib/navigation";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["/", "/contact"];
  const urls = new Set<string>([...staticRoutes, ...allRoutes.map((r) => r.href)]);

  return Array.from(urls).map((url) => ({
    url: `${site.url}${url}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: url === "/" ? 1 : 0.7,
  }));
}
