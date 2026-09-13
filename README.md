# RedCanvas Studio

An **offline‑first, Canva‑style graphic design editor** built with Next.js 14, React 18 and TypeScript.
No backend, no accounts — everything (116 bundled fonts, tools, and your projects) lives on the device.

## Features
- Blank canvas with custom sizes + 40 presets (social posts, stories, thumbnails, flyers, posters, logos, presentations, print…)
- 116 offline fonts (bundled via `@fontsource`, cached by the service worker)
- Text: size, weight, italic/underline/uppercase, alignment, line-height, letter-spacing, solid/gradient fill, stroke, shadow, glow, opacity
- Images: upload from device, crop, resize, rotate, flip, blur, 10 filter presets, adjustments (brightness/contrast/saturation/hue/grayscale/sepia/invert), corner radius, masks (circle, hex, star, heart…), frames, border, shadow, glow
- 23 shapes, lines & arrows (dash styles, heads), 150+ icons – all recolorable
- Backgrounds: solid, gradient (editor + presets), image, grain/noise, patterns, transparent
- Layers panel: drag reorder, group/ungroup, duplicate, lock, hide, rename, delete
- Undo/redo (80 steps), copy/paste/cut/duplicate, paste images from clipboard
- Snap to objects/canvas/grid, rulers, draggable guides, alignment & distribution tools
- Zoom (wheel, pinch, keyboard), pan (space/drag, 2‑finger), fullscreen canvas
- Color picker with HSV area, alpha, hex, palette, recent colors, eyedropper (native EyeDropper or canvas sampling)
- Multiple pages: add, duplicate, reorder, rename, delete – with live thumbnails
- Export PNG / JPG / WebP with scale (0.5×–3× or exact px), quality and transparency; export all pages
- Autosave to IndexedDB, project manager (thumbnails, duplicate, delete), `.redcanvas` import/export for backups
- Installable PWA with offline service worker; responsive touch UI for phones/tablets
- Prominent warnings that local projects can be lost when clearing site data / uninstalling

## Development
```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Deploy to Vercel
Push this folder to a Git repo and import it in Vercel (framework preset: **Next.js**). No environment variables are required.
The service worker (`public/sw.js`) is registered in production builds only.

## Keyboard shortcuts
Press `?` inside the editor.

## Verified (headless Chromium)
- Create/edit/export flows on desktop and iPhone viewport (touch drag, pinch zoom, bottom sheets)
- PNG (2×, all pages), WebP and `.redcanvas` exports; re‑import of the backup into a fresh browser profile
- Full offline reload + editing with fonts served from the service‑worker cache
