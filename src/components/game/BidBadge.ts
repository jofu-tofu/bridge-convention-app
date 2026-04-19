export type AnnotationType = "alert" | "announce" | "educational";

/** Display-only abbreviation for auction cells. */
export function displayBidText(text: string): string {
  if (text === "Pass") return "P";
  return text;
}
