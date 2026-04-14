import type { QualiaBand } from "./qualia-types";

export const ORAL_DRYNESS: Record<Exclude<QualiaBand, "silent">, string> = {
  whisper: "your mouth feels slightly thick",
  notable: "a dry tightening coats your throat",
  prominent: "your throat feels close and rough, and each swallow takes effort",
  overwhelming: "your throat is a cracked, consuming demand that breaks your focus",
};

export const VISCERAL_CONTRACTION: Record<Exclude<QualiaBand, "silent">, string> = {
  whisper: "a faint restlessness sits somewhere in your core",
  notable: "a hollow pull gathers inside you",
  prominent: "the gnawing in your core is hard to ignore",
  overwhelming: "your body is consuming itself from within",
};

export const CHEST_PRESSURE: Record<Exclude<QualiaBand, "silent">, string> = {
  whisper: "your chest feels slightly narrow",
  notable: "your chest tightens and asks for effort",
  prominent: "breathing feels strained and urgent",
  overwhelming: "air feels unreachable and panic crowds in",
};

export const BITTER_TASTE: Record<Exclude<QualiaBand, "silent">, string> = {
  whisper: "a faint warning-sharpness touches your tongue",
  notable: "a bitter edge makes your mouth tighten",
  prominent: "a violent bitter shock floods your mouth",
  overwhelming: "your mouth rejects the taste before thought can form",
};

export const PAIN_SHOCK: Record<Exclude<QualiaBand, "silent">, string> = {
  whisper: "a thin ache traces through one part of you",
  notable: "a sharp discomfort insists on attention",
  prominent: "pain drives a hard signal through your body",
  overwhelming: "pain eclipses everything else",
};

export function textForBand(
  template: Record<Exclude<QualiaBand, "silent">, string>,
  band: QualiaBand,
): string | null {
  if (band === "silent") return null;
  return template[band];
}
