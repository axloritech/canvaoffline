export type ElementType = "text" | "image" | "shape" | "line" | "icon" | "group";

export type ShapeKind =
  | "rect" | "rounded" | "circle" | "ellipse" | "triangle" | "diamond" | "pentagon" | "hexagon"
  | "star" | "heart" | "arrow-right" | "arrow-left" | "arrow-up" | "arrow-down" | "chevron"
  | "speech" | "cross" | "ring" | "half-circle" | "parallelogram" | "trapezoid" | "octagon" | "blob";

export type MaskKind = "none" | "circle" | "rounded" | "star" | "heart" | "hexagon" | "diamond" | "triangle" | "blob";

export interface Shadow { enabled: boolean; x: number; y: number; blur: number; color: string; opacity: number }
export interface Glow { enabled: boolean; blur: number; color: string; opacity: number }
export interface Stroke { enabled: boolean; width: number; color: string }
export interface GradientStop { color: string; pos: number }
export interface Gradient { type: "linear" | "radial"; angle: number; stops: GradientStop[] }

export interface Fill {
  type: "solid" | "gradient";
  color: string;
  gradient: Gradient;
}

export type TextureKind = "film-grain" | "fine-grain" | "heavy-grain" | "vintage-grain" | "analog-film" | "film-dust" | "film-scratches" | "paper-grain" | "paper-texture" | "canvas-texture" | "noise" | "color-noise" | "digital-noise" | "halftone" | "print-dots" | "retro-print" | "newspaper" | "risograph";
export interface Texture {
  enabled: boolean;
  kind: TextureKind;
  intensity: number;   // 0..100 contrast / density of the effect
  size: number;        // 0..100 grain / dot size
  scale: number;       // 25..400 % tile scale
  opacity: number;     // 0..100
  blend: "overlay" | "soft-light" | "multiply" | "screen" | "normal" | "hard-light" | "difference" | "luminosity" | "color-burn" | "color-dodge";
  randomness: number;  // 0..100
  color: string;
  seed: number;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  x: number; y: number; width: number; height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  flipX: boolean; flipY: boolean;
  shadow: Shadow;
  glow: Glow;
  groupId?: string;
  texture?: Texture;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  align: "left" | "center" | "right" | "justify";
  lineHeight: number;
  letterSpacing: number;
  fill: Fill;
  stroke: Stroke;
  autoWidth: boolean;
}

export interface ImageFilters {
  brightness: number; contrast: number; saturation: number; hue: number;
  blur: number; grayscale: number; sepia: number; invert: number;
  preset: string;
}

export interface Crop { x: number; y: number; w: number; h: number } // fractions 0..1

export interface ImageElement extends BaseElement {
  type: "image";
  assetId: string;      // key in assets map (data URL)
  naturalW: number; naturalH: number;
  crop: Crop;
  filters: ImageFilters;
  radius: number;
  mask: MaskKind;
  frame: { enabled: boolean; width: number; color: string };
  stroke: Stroke;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: ShapeKind;
  fill: Fill;
  stroke: Stroke;
  radius: number;
}

export interface LineElement extends BaseElement {
  type: "line";
  color: string;
  thickness: number;
  dash: "solid" | "dashed" | "dotted";
  startHead: "none" | "arrow" | "circle" | "square";
  endHead: "none" | "arrow" | "circle" | "square";
}

export interface IconElement extends BaseElement {
  type: "icon";
  icon: string; // lucide icon name
  color: string;
  strokeWidth: number;
}

export interface GroupElement extends BaseElement {
  type: "group";
  children: string[];
}

export type DesignElement = TextElement | ImageElement | ShapeElement | LineElement | IconElement | GroupElement;

export interface Background {
  type: "solid" | "gradient" | "image";
  color: string;
  gradient: Gradient;
  assetId?: string;
  noise: number; // 0..100
  pattern: "none" | "dots" | "grid" | "lines" | "diagonal";
  patternColor: string;
  patternOpacity: number;
  texture?: Texture;
}

export interface Page {
  id: string;
  name: string;
  background: Background;
  elements: DesignElement[];
}

export interface Guide { id: string; axis: "x" | "y"; pos: number }

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  pages: Page[];
  assets: Record<string, string>; // assetId -> dataURL
  guides: Guide[];
  createdAt: number;
  updatedAt: number;
  version: 1;
}

export interface ProjectMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  thumbnail?: string;
  pageCount: number;
}

export interface Preset { name: string; width: number; height: number; category: string }
