import type { Metadata, Viewport } from "next";
import "@/styles/fonts.css";
import "@/styles/globals.css";
import { PWA } from "@/components/PWA";

const SITE_URL = "https://canvaoffline.vercel.app";
const TITLE = "RedCanvas Studio — Free Offline Graphic Design Editor (Canva Alternative)";
const DESC = "RedCanvas Studio is a free, offline-first graphic design editor. Create social media posts, flyers, posters, YouTube thumbnails, logos and presentations in your browser — 116 fonts, layers, images, shapes, gradients and PNG/JPG/WebP export. No account, no internet required.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  verification: { google: "FBg_7gsdbuB_IvALObhs0pNpHArJqMK1KGYudoO_GTo" },
  title: { default: TITLE, template: "%s · RedCanvas Studio" },
  description: DESC,
  keywords: ["RedCanvas Studio", "RedCanvas", "offline design editor", "Canva alternative", "free graphic design app", "flyer maker", "poster maker", "thumbnail maker", "logo maker", "offline Canva", "PWA design tool", "axloritech"],
  authors: [{ name: "Axloritech" }],
  creator: "Axloritech",
  publisher: "Axloritech",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: { type: "website", url: SITE_URL, siteName: "RedCanvas Studio", title: TITLE, description: DESC, locale: "en_NG", images: [{ url: "/og.png", width: 1200, height: 630, alt: "RedCanvas Studio — offline graphic design editor" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og.png"], creator: "@axloritech" },
  manifest: "/manifest.webmanifest",
  applicationName: "RedCanvas Studio",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RedCanvas" },
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/icon-192.png" },
  category: "design",
};
export const viewport: Viewport = {
  themeColor: "#e11d2e", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "RedCanvas Studio",
      alternateName: "RedCanvas",
      url: SITE_URL,
      description: DESC,
      applicationCategory: "DesignApplication",
      operatingSystem: "Any (Web, Android, iOS, Windows, macOS — works offline as a PWA)",
      browserRequirements: "Requires a modern browser with JavaScript",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: ["Offline-first PWA", "116 bundled fonts", "Layers, groups, undo/redo", "Image filters, crop, masks & frames", "Shapes, icons, gradients & backgrounds", "Multi-page designs", "PNG / JPG / WebP export", "Local project storage & .redcanvas files"],
      author: { "@type": "Organization", name: "Axloritech" },
      publisher: { "@type": "Organization", name: "Axloritech" },
      image: `${SITE_URL}/og.png`,
    },
    { "@type": "WebSite", name: "RedCanvas Studio", url: SITE_URL, publisher: { "@type": "Organization", name: "Axloritech" } },
    { "@type": "Organization", name: "Axloritech", url: SITE_URL, logo: `${SITE_URL}/icons/icon-512.png` },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        {children}
        <PWA />
      </body>
    </html>
  );
}
