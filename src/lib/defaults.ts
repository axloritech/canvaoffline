import type {
  Background, DesignElement, Fill, Gradient, IconElement, ImageElement, LineElement, Page, Preset, Project,
  ShapeElement, ShapeKind, TextElement, Shadow, Glow, Stroke,
} from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const RED = "#e11d2e";

export const PRESETS: Preset[] = [
  { name: "Instagram Post", width: 1080, height: 1080, category: "Social Media" },
  { name: "Instagram Story", width: 1080, height: 1920, category: "Social Media" },
  { name: "Instagram Portrait", width: 1080, height: 1350, category: "Social Media" },
  { name: "Facebook Post", width: 1200, height: 630, category: "Social Media" },
  { name: "Facebook Cover", width: 1640, height: 924, category: "Social Media" },
  { name: "X / Twitter Post", width: 1600, height: 900, category: "Social Media" },
  { name: "X / Twitter Header", width: 1500, height: 500, category: "Social Media" },
  { name: "LinkedIn Post", width: 1200, height: 1200, category: "Social Media" },
  { name: "LinkedIn Banner", width: 1584, height: 396, category: "Social Media" },
  { name: "Pinterest Pin", width: 1000, height: 1500, category: "Social Media" },
  { name: "TikTok Video Cover", width: 1080, height: 1920, category: "Social Media" },
  { name: "WhatsApp Status", width: 1080, height: 1920, category: "Social Media" },
  { name: "YouTube Thumbnail", width: 1280, height: 720, category: "Video" },
  { name: "YouTube Banner", width: 2560, height: 1440, category: "Video" },
  { name: "Full HD (16:9)", width: 1920, height: 1080, category: "Video" },
  { name: "4K UHD", width: 3840, height: 2160, category: "Video" },
  { name: "Presentation 16:9", width: 1920, height: 1080, category: "Presentation" },
  { name: "Presentation 4:3", width: 1024, height: 768, category: "Presentation" },
  { name: "A4 Flyer (Portrait)", width: 2480, height: 3508, category: "Print" },
  { name: "A4 (Landscape)", width: 3508, height: 2480, category: "Print" },
  { name: "A5 Flyer", width: 1748, height: 2480, category: "Print" },
  { name: "US Letter", width: 2550, height: 3300, category: "Print" },
  { name: "Poster 18×24 in", width: 5400, height: 7200, category: "Print" },
  { name: "Poster 24×36 in", width: 7200, height: 10800, category: "Print" },
  { name: "Business Card", width: 1050, height: 600, category: "Print" },
  { name: "Postcard", width: 1800, height: 1200, category: "Print" },
  { name: "Logo (Square)", width: 1000, height: 1000, category: "Branding" },
  { name: "Logo (Wide)", width: 1600, height: 600, category: "Branding" },
  { name: "App Icon", width: 1024, height: 1024, category: "Branding" },
  { name: "Favicon", width: 512, height: 512, category: "Branding" },
  { name: "Email Header", width: 1200, height: 400, category: "Marketing" },
  { name: "Web Banner", width: 1920, height: 600, category: "Marketing" },
  { name: "Leaderboard Ad", width: 728, height: 90, category: "Marketing" },
  { name: "Medium Rectangle Ad", width: 300, height: 250, category: "Marketing" },
  { name: "Certificate", width: 3300, height: 2550, category: "Documents" },
  { name: "Invitation 5×7 in", width: 1500, height: 2100, category: "Documents" },
  { name: "Resume / CV", width: 2480, height: 3508, category: "Documents" },
  { name: "Infographic", width: 800, height: 2000, category: "Documents" },
  { name: "Phone Wallpaper", width: 1170, height: 2532, category: "Wallpaper" },
  { name: "Desktop Wallpaper", width: 2560, height: 1440, category: "Wallpaper" },
  { name: "Book Cover", width: 1600, height: 2560, category: "Publishing" },
  { name: "Album Cover", width: 3000, height: 3000, category: "Publishing" },
];

export const defaultGradient = (): Gradient => ({
  type: "linear", angle: 90,
  stops: [{ color: "#e11d2e", pos: 0 }, { color: "#ff8a5b", pos: 100 }],
});
export const solidFill = (color: string): Fill => ({ type: "solid", color, gradient: defaultGradient() });
export const noShadow = (): Shadow => ({ enabled: false, x: 4, y: 4, blur: 10, color: "#000000", opacity: 0.5 });
export const noGlow = (): Glow => ({ enabled: false, blur: 20, color: "#e11d2e", opacity: 0.8 });
export const noStroke = (): Stroke => ({ enabled: false, width: 2, color: "#111111" });

export const defaultBackground = (): Background => ({
  type: "solid", color: "#ffffff", gradient: defaultGradient(), noise: 0,
  pattern: "none", patternColor: "#000000", patternOpacity: 0.08,
});

const base = (type: DesignElement["type"], name: string, w: number, h: number, x = 100, y = 100) => ({
  id: uid(), type, name, x, y, width: w, height: h, rotation: 0, opacity: 1, locked: false, hidden: false,
  flipX: false, flipY: false, shadow: noShadow(), glow: noGlow(),
});

export const newText = (text = "Add your text", opts: Partial<TextElement> = {}): TextElement => ({
  ...(base("text", "Text", 400, 60) as any),
  text, fontFamily: "Poppins", fontSize: 40, fontWeight: 400, italic: false, underline: false, uppercase: false,
  align: "left", lineHeight: 1.2, letterSpacing: 0, fill: solidFill("#111111"), stroke: noStroke(), autoWidth: true,
  ...opts,
});

export const newShape = (shape: ShapeKind, opts: Partial<ShapeElement> = {}): ShapeElement => ({
  ...(base("shape", shape.charAt(0).toUpperCase() + shape.slice(1), 240, 240) as any),
  shape, fill: solidFill(RED), stroke: noStroke(), radius: shape === "rounded" ? 32 : 0, ...opts,
});

export const newLine = (opts: Partial<LineElement> = {}): LineElement => ({
  ...(base("line", "Line", 300, 24) as any),
  color: "#111111", thickness: 4, dash: "solid", startHead: "none", endHead: "none", ...opts,
});

export const newIcon = (icon: string, opts: Partial<IconElement> = {}): IconElement => ({
  ...(base("icon", icon, 120, 120) as any),
  icon, color: "#111111", strokeWidth: 2, ...opts,
});

export const newImage = (assetId: string, nw: number, nh: number, w: number, h: number): ImageElement => ({
  ...(base("image", "Image", w, h) as any),
  assetId, naturalW: nw, naturalH: nh, crop: { x: 0, y: 0, w: 1, h: 1 },
  filters: { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, grayscale: 0, sepia: 0, invert: 0, preset: "none" },
  radius: 0, mask: "none", frame: { enabled: false, width: 12, color: "#ffffff" }, stroke: noStroke(),
});

export const newPage = (name = "Page 1"): Page => ({ id: uid(), name, background: defaultBackground(), elements: [] });

export const newProject = (name: string, width: number, height: number): Project => ({
  id: uid(), name, width, height, pages: [newPage()], assets: {}, guides: [],
  createdAt: Date.now(), updatedAt: Date.now(), version: 1,
});

export const FILTER_PRESETS: Record<string, Partial<ImageElement["filters"]>> = {
  none: { brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: 0, sepia: 0, invert: 0 },
  vivid: { brightness: 105, contrast: 115, saturation: 140, hue: 0, grayscale: 0, sepia: 0, invert: 0 },
  mono: { brightness: 100, contrast: 110, saturation: 100, hue: 0, grayscale: 100, sepia: 0, invert: 0 },
  noir: { brightness: 90, contrast: 140, saturation: 100, hue: 0, grayscale: 100, sepia: 0, invert: 0 },
  vintage: { brightness: 105, contrast: 90, saturation: 80, hue: 0, grayscale: 0, sepia: 45, invert: 0 },
  warm: { brightness: 105, contrast: 100, saturation: 120, hue: -10, grayscale: 0, sepia: 20, invert: 0 },
  cool: { brightness: 100, contrast: 105, saturation: 110, hue: 15, grayscale: 0, sepia: 0, invert: 0 },
  fade: { brightness: 115, contrast: 80, saturation: 85, hue: 0, grayscale: 10, sepia: 10, invert: 0 },
  dramatic: { brightness: 90, contrast: 150, saturation: 90, hue: 0, grayscale: 0, sepia: 0, invert: 0 },
  invert: { brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: 0, sepia: 0, invert: 100 },
};

export const GRADIENT_PRESETS: Gradient[] = [
  { type: "linear", angle: 90, stops: [{ color: "#e11d2e", pos: 0 }, { color: "#ff8a5b", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#667eea", pos: 0 }, { color: "#764ba2", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#f093fb", pos: 0 }, { color: "#f5576c", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#4facfe", pos: 0 }, { color: "#00f2fe", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#43e97b", pos: 0 }, { color: "#38f9d7", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#fa709a", pos: 0 }, { color: "#fee140", pos: 100 }] },
  { type: "linear", angle: 180, stops: [{ color: "#0f0c29", pos: 0 }, { color: "#302b63", pos: 50 }, { color: "#24243e", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#ff9a9e", pos: 0 }, { color: "#fecfef", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#a18cd1", pos: 0 }, { color: "#fbc2eb", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#fddb92", pos: 0 }, { color: "#d1fdff", pos: 100 }] },
  { type: "linear", angle: 135, stops: [{ color: "#000000", pos: 0 }, { color: "#434343", pos: 100 }] },
  { type: "radial", angle: 0, stops: [{ color: "#ffffff", pos: 0 }, { color: "#e5e7eb", pos: 100 }] },
  { type: "radial", angle: 0, stops: [{ color: "#ff5f6d", pos: 0 }, { color: "#8e0e00", pos: 100 }] },
  { type: "linear", angle: 45, stops: [{ color: "#11998e", pos: 0 }, { color: "#38ef7d", pos: 100 }] },
  { type: "linear", angle: 45, stops: [{ color: "#f7971e", pos: 0 }, { color: "#ffd200", pos: 100 }] },
  { type: "linear", angle: 45, stops: [{ color: "#2193b0", pos: 0 }, { color: "#6dd5ed", pos: 100 }] },
];

export const SOLID_PALETTE = [
  "#000000", "#1f2937", "#6b7280", "#d1d5db", "#ffffff", "#e11d2e", "#f43f5e", "#f97316", "#f59e0b", "#facc15",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#7c2d12", "#78350f", "#fde68a", "#fecaca", "#bfdbfe", "#bbf7d0", "#e9d5ff", "#fbcfe8",
];

export const ICON_NAMES = [
  "Heart", "Star", "Zap", "Sparkles", "Flame", "Sun", "Moon", "Cloud", "Umbrella", "Snowflake", "Leaf", "Flower2", "TreePine",
  "Camera", "Image", "Music", "Headphones", "Mic", "Video", "Film", "Tv", "Radio", "Gamepad2", "Smartphone", "Laptop", "Monitor",
  "Phone", "Mail", "MessageCircle", "Send", "Bell", "Megaphone", "Share2", "Link", "Globe", "MapPin", "Navigation", "Compass",
  "Home", "Building2", "Store", "ShoppingBag", "ShoppingCart", "Gift", "Tag", "CreditCard", "Wallet", "DollarSign", "Percent",
  "TrendingUp", "BarChart3", "PieChart", "Target", "Award", "Trophy", "Medal", "Crown", "Gem", "Rocket", "Lightbulb", "Brain",
  "Coffee", "Pizza", "Utensils", "Wine", "Cake", "IceCream", "Apple", "Car", "Bike", "Plane", "Ship", "Train", "Bus",
  "User", "Users", "UserCircle", "Smile", "ThumbsUp", "Hand", "Eye", "Shield", "Lock", "Key", "Check", "CheckCircle2", "X",
  "Plus", "Minus", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ArrowUpRight", "ChevronRight", "MoveRight", "CornerDownRight",
  "Play", "Pause", "SkipForward", "Volume2", "Wifi", "Bluetooth", "Battery", "Clock", "Calendar", "Timer", "Hourglass",
  "Scissors", "PenTool", "Paintbrush", "Palette", "Layers", "Box", "Package", "Briefcase", "GraduationCap", "BookOpen", "Bookmark",
  "Dumbbell", "Activity", "HeartPulse", "Stethoscope", "Pill", "Syringe", "Baby", "Dog", "Cat", "Bird", "Fish", "Bug",
  "Instagram", "Facebook", "Twitter", "Youtube", "Linkedin", "Github", "Twitch", "Quote", "Hash", "AtSign", "Infinity", "Anchor",
];

export const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "rect", label: "Square" }, { kind: "rounded", label: "Rounded" }, { kind: "circle", label: "Circle" },
  { kind: "ellipse", label: "Ellipse" }, { kind: "triangle", label: "Triangle" }, { kind: "diamond", label: "Diamond" },
  { kind: "pentagon", label: "Pentagon" }, { kind: "hexagon", label: "Hexagon" }, { kind: "octagon", label: "Octagon" },
  { kind: "star", label: "Star" }, { kind: "heart", label: "Heart" }, { kind: "arrow-right", label: "Arrow R" },
  { kind: "arrow-left", label: "Arrow L" }, { kind: "arrow-up", label: "Arrow Up" }, { kind: "arrow-down", label: "Arrow Dn" },
  { kind: "chevron", label: "Chevron" }, { kind: "speech", label: "Speech" }, { kind: "cross", label: "Cross" },
  { kind: "ring", label: "Ring" }, { kind: "half-circle", label: "Half" }, { kind: "parallelogram", label: "Slant" },
  { kind: "trapezoid", label: "Trapezoid" }, { kind: "blob", label: "Blob" },
];
