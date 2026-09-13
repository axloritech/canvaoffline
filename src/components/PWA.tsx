"use client";
import { useEffect } from "react";
const OCR_ASSETS = ["/ocr/worker.min.js", "/ocr/core/tesseract-core-simd-lstm.wasm.js", "/ocr/core/tesseract-core-lstm.wasm.js", "/ocr/lang/eng.traineddata.gz"];
export function PWA() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").then(async () => {
      // Prefetch the local OCR engine (~11 MB) once so "Import & Edit" works fully offline.
      try {
        const cache = await caches.open("rc-ocr-v1");
        const missing: string[] = [];
        for (const u of OCR_ASSETS) if (!(await cache.match(u))) missing.push(u);
        if (!missing.length) return;
        const idle = (cb: () => void) => ("requestIdleCallback" in window ? (window as any).requestIdleCallback(cb, { timeout: 8000 }) : setTimeout(cb, 3000));
        idle(() => cache.addAll(missing).catch(() => {}));
      } catch {}
    }).catch(() => {});
  }, []);
  return null;
}
