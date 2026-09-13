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
