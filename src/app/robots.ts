import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/shell", "/initialize", "/api/", "/ctx/"],
      },
    ],
    sitemap: "https://you.md/sitemap.xml",
  };
}
