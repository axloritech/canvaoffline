import type { Metadata, Viewport } from "next";
import "@/styles/fonts.css";
import "@/styles/globals.css";
import { PWA } from "@/components/PWA";

export const metadata: Metadata = {
  title: "RedCanvas Studio — Offline Design Editor",
  description: "Professional offline-first graphic design editor. Create social posts, flyers, posters, thumbnails, logos and more — no internet required.",
  manifest: "/manifest.webmanifest",
  applicationName: "RedCanvas Studio",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RedCanvas" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = {
  themeColor: "#e11d2e", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PWA />
      </body>
    </html>
  );
}
