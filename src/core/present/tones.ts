/** tones: the hint tone a value carries and the atom's name for it. */
import { Field, HintTone } from "../catalog";
import { policyOption } from "../derivePolicy";

/**
 * enumTone is how one value of a closed set should read: which of its values is
 * good, which is a warning. Nothing is inferred — an unlabelled value is neutral
 * the way it is today — and `badgeTone` is the one cast into the colours this
 * build ships, so no atom maps a word it cannot draw.
 */
export const enumTone = (f: Field, value: string): HintTone =>
  (policyOption(f, value)?.tone as HintTone | undefined) ??
  f.hints?.enumTones?.[value] ??
  "neutral";

/** badgeTone is the atom's name for a hint tone: the kernel says `success`, the kit says `ok`. */
export const badgeTone = (tone: HintTone): "ok" | "warning" | "danger" | "info" | "neutral" =>
  tone === "success" ? "ok" : tone;
