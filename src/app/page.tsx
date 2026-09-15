import dynamic from "next/dynamic";
const App = dynamic(() => import("@/components/App"), { ssr: false, loading: () => <div className="splash"><div className="splash-logo" /><span>RedCanvas Studio</span></div> });

/* Server-rendered, crawlable description of the product. It is visually hidden once the
   client app mounts (see .seo in globals.css) but is present in the HTML for search engines. */
function SeoContent() {
  return (
    <section className="seo" aria-hidden="false">
      <h1>RedCanvas Studio — Free Offline Graphic Design Editor</h1>
      <p>RedCanvas Studio is a free, professional, offline-first design tool by Axloritech. Design social media posts, flyers, posters, YouTube thumbnails, logos, business cards and presentations directly in your browser — no account, no subscription and no internet connection required once installed.</p>
      <h2>Features</h2>
      <ul>
        <li>Works completely offline as an installable PWA (Android, iPhone, Windows, macOS)</li>
        <li>116 bundled fonts with size, colour, gradient, spacing, shadow, stroke and glow controls</li>
        <li>Image upload with crop, resize, rotate, flip, filters, adjustments, masks and frames</li>
        <li>Shapes, lines, arrows and 140+ icons with custom colours</li>
        <li>Solid, gradient and noise backgrounds</li>
        <li>Layers, groups, lock, hide, duplicate, full undo/redo, snap-to-grid, rulers and guides</li>
        <li>Multiple pages per project</li>
        <li>Export PNG, JPG and WebP at up to 4× resolution</li>
        <li>Projects saved on your device; back up and share as .redcanvas files</li>
      </ul>
      <h2>Canva alternative that works offline</h2>
      <p>Unlike online editors, RedCanvas Studio stores fonts, icons and your projects locally, so it keeps working on slow or missing connections — ideal for designers, students, small businesses and content creators in Nigeria and worldwide.</p>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <SeoContent />
      <App />
    </>
  );
}
