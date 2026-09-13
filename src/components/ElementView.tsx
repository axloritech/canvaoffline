"use client";
import React, { memo } from "react";
import * as Lucide from "lucide-react";
import type { DesignElement, TextElement, ImageElement, ShapeElement, LineElement, IconElement } from "@/lib/types";
import { fillCss, dropShadowFilter, textShadowCss, imageFilterCss, shapePath, maskSvgPath, hexToRgba } from "@/lib/render";

export function textStyle(el: TextElement): React.CSSProperties {
  const isGrad = el.fill.type === "gradient";
  const stroke = el.stroke.enabled && el.stroke.width > 0 ? `${el.stroke.width}px ${el.stroke.color}` : undefined;
  return {
    fontFamily: `"${el.fontFamily}", sans-serif`, fontSize: el.fontSize, fontWeight: el.fontWeight, fontStyle: el.italic ? "italic" : "normal",
    textDecoration: el.underline ? "underline" : "none", textTransform: el.uppercase ? "uppercase" : "none",
    textAlign: el.align, lineHeight: el.lineHeight, letterSpacing: el.letterSpacing,
    color: isGrad ? "transparent" : el.fill.color, backgroundImage: isGrad ? fillCss(el.fill) : undefined,
    textShadow: isGrad ? undefined : textShadowCss(el.shadow, el.glow),
    filter: isGrad ? dropShadowFilter(el.shadow, el.glow) || undefined : undefined,
    WebkitTextStroke: stroke, paintOrder: "stroke fill",
    width: "100%", height: "100%", padding: 0, margin: 0, whiteSpace: el.autoWidth ? "pre" : "pre-wrap",
  };
}

const TextView = memo(function TextView({ el }: { el: TextElement }) {
  return <div className={"el-text" + (el.fill.type === "gradient" ? " gradient" : "")} style={textStyle(el)}>{el.text || " "}</div>;
});

const ImageView = memo(function ImageView({ el, src }: { el: ImageElement; src?: string }) {
  const W = el.width, H = el.height;
  const clipId = `clip-${el.id}`;
  const path = el.mask !== "none" ? maskSvgPath(el.mask, W, H) : el.radius > 0 ? shapePath("rounded", W, H, el.radius) : null;
  const c = el.crop;
  // Position the full image so that the crop region fills the box
  const imgStyle: React.CSSProperties = {
    position: "absolute", left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%`, width: `${(1 / c.w) * 100}%`, height: `${(1 / c.h) * 100}%`,
    filter: imageFilterCss(el.filters), objectFit: "fill", display: "block", pointerEvents: "none",
  };
  const strokes = (
    <>
      {el.frame.enabled && <path d={path ?? shapePath("rect", W, H)} fill="none" stroke={el.frame.color} strokeWidth={el.frame.width * 2} clipPath={`url(#${clipId})`} />}
      {el.stroke.enabled && <path d={path ?? shapePath("rect", W, H)} fill="none" stroke={el.stroke.color} strokeWidth={el.stroke.width} />}
    </>
  );
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", filter: dropShadowFilter(el.shadow, el.glow) || undefined }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs><clipPath id={clipId}>{path ? <path d={path} /> : <rect width={W} height={H} />}</clipPath></defs>
        {!src && <rect width={W} height={H} fill="#eee" />}
        <foreignObject width={W} height={H} clipPath={`url(#${clipId})`}>
          <div style={{ width: W, height: H, position: "relative", overflow: "hidden" }}>
            {src ? <img src={src} alt="" style={imgStyle} draggable={false} /> : <div style={{ width: "100%", height: "100%", background: "#e5e7eb" }} />}
          </div>
        </foreignObject>
        {strokes}
      </svg>
    </div>
  );
});

const ShapeView = memo(function ShapeView({ el }: { el: ShapeElement }) {
  const gid = `g-${el.id}`;
  const d = shapePath(el.shape, el.width, el.height, el.radius);
  const g = el.fill.gradient;
  return (
    <svg width={el.width} height={el.height} style={{ display: "block", overflow: "visible", filter: dropShadowFilter(el.shadow, el.glow) || undefined }}>
      {el.fill.type === "gradient" && (
        <defs>
          {g.type === "linear"
            ? <linearGradient id={gid} gradientTransform={`rotate(${g.angle - 90} .5 .5)`}>{g.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</linearGradient>
            : <radialGradient id={gid}>{g.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</radialGradient>}
        </defs>
      )}
      <path d={d} fill={el.fill.type === "gradient" ? `url(#${gid})` : el.fill.color} fillRule="evenodd"
        stroke={el.stroke.enabled ? el.stroke.color : "none"} strokeWidth={el.stroke.enabled ? el.stroke.width : 0} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
});

const LineView = memo(function LineView({ el }: { el: LineElement }) {
  const W = el.width, H = el.height, t = el.thickness, y = H / 2, hl = t * 3;
  const x1 = el.startHead !== "none" ? hl : 0, x2 = el.endHead !== "none" ? W - hl : W;
  const dash = el.dash === "dashed" ? `${t * 3} ${t * 2}` : el.dash === "dotted" ? `0 ${t * 2}` : undefined;
  const head = (kind: string, x: number, dir: 1 | -1) => {
    if (kind === "arrow") return <polygon points={`${x},${y} ${x - dir * hl},${y - hl * 0.6} ${x - dir * hl},${y + hl * 0.6}`} fill={el.color} />;
    if (kind === "circle") return <circle cx={x - (dir * hl) / 2} cy={y} r={hl / 2} fill={el.color} />;
    if (kind === "square") return <rect x={dir === 1 ? x - hl : x} y={y - hl / 2} width={hl} height={hl} fill={el.color} />;
    return null;
  };
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible", filter: dropShadowFilter(el.shadow, el.glow) || undefined }}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={el.color} strokeWidth={t} strokeDasharray={dash} strokeLinecap={el.dash === "dotted" ? "round" : "butt"} />
      {head(el.endHead, W, 1)}{head(el.startHead, 0, -1)}
    </svg>
  );
});

const IconView = memo(function IconView({ el }: { el: IconElement }) {
  const Icon = (Lucide as any)[el.icon] ?? Lucide.HelpCircle;
  return <div style={{ width: "100%", height: "100%", filter: dropShadowFilter(el.shadow, el.glow) || undefined }}><Icon color={el.color} strokeWidth={el.strokeWidth} width="100%" height="100%" /></div>;
});

export function ElementContent({ el, assets }: { el: DesignElement; assets: Record<string, string> }) {
  switch (el.type) {
    case "text": return <TextView el={el} />;
    case "image": return <ImageView el={el} src={assets[el.assetId]} />;
    case "shape": return <ShapeView el={el} />;
    case "line": return <LineView el={el} />;
    case "icon": return <IconView el={el} />;
    default: return null;
  }
}

export function elementTransform(el: DesignElement) {
  return `rotate(${el.rotation}deg) scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`;
}

export { hexToRgba };
