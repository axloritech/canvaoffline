import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/ocr/", "/sw.js", "/offline.html"] }], sitemap: "https://canvaoffline.vercel.app/sitemap.xml", host: "https://canvaoffline.vercel.app" };
}
