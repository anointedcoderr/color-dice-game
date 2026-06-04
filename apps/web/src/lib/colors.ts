import type { ColorName } from "./types";

// Keep this list byte-identical (order + spelling) to the backend:
//   apps/server/src/shared/colors.ts and the Prisma `Colour` enum.
export const COLORS: ColorName[] = ["red", "black", "blue", "green", "yellow", "white"];

export const COLOR_HEX: Record<ColorName, string> = {
  red: "#FF3B5C",
  black: "#1E1E24",
  blue: "#2D7DFF",
  green: "#21E6A4",
  yellow: "#FFD23F",
  white: "#F5F7FF",
};

// box-shadow colour for a settled/glowing face
export const COLOR_GLOW: Record<ColorName, string> = {
  red: "rgba(255,59,92,0.65)",
  black: "rgba(120,120,140,0.55)",
  blue: "rgba(45,125,255,0.65)",
  green: "rgba(33,230,164,0.65)",
  yellow: "rgba(255,210,63,0.65)",
  white: "rgba(245,247,255,0.70)",
};

// readable text colour to place on top of a coloured face
export const COLOR_TEXT_ON: Record<ColorName, string> = {
  red: "#FFFFFF",
  black: "#FFFFFF",
  blue: "#FFFFFF",
  green: "#06281F",
  yellow: "#3A2D00",
  white: "#1E1E24",
};

export const NEUTRAL_HEX = "#2A2A35";
export const NEUTRAL_GLOW = "rgba(160,160,190,0.25)";

export function colorLabel(c: ColorName): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}
