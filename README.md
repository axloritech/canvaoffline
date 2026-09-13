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


## Import & Edit (PNG / JPG → editable layers)

`Home → Import & Edit` (also in the editor's ⋯ menu). Everything runs **on the device** – no upload, no backend.

| Input | What you get |
|---|---|
| `.redcanvas` project file | 100 % accurate restore of every layer, page, font and asset |
| Flat PNG / JPG / WebP | Best‑effort reconstruction: background (solid / gradient / photo), rectangles, rounded boxes, circles, cut‑out images, and **editable text** with estimated font size, weight, colour and alignment |

How it works (`src/lib/analyze.ts`):
1. Background model from the border pixels (solid → gradient → photo fallback).
2. Local OCR with **Tesseract.js** (LSTM engine, English data bundled under `public/ocr/`, ~11 MB, cached by the service worker on first visit so it works offline). Two passes (normal + inverted) catch light‑on‑dark text; boxes are tightened to real ink and glued icons are split off.
3. Text pixels are inpainted so they don't ghost behind the new text layers.
4. Remaining foreground is segmented into connected components and classified as rect / rounded / ellipse / image (cut out with transparent background where possible).
5. Text colour, stroke weight (→ font weight), size (fit to measured width), line height and alignment are estimated and mapped to the closest bundled font.

Limitations: the exact original font can't be identified; heavily stylised text, very small text and complex photo backgrounds reduce accuracy. Every detected layer is fully editable afterwards; images can be swapped with **Replace image** (keeps position and size).
