/**
 * Detect LLM *assistant* replies mistakenly used as a CAD / generate prompt
 * (e.g. after Polish or copy-paste from the co-pilot).
 */

const CAD_HINT =
  /\b(M\d+\b|\d+\s*mm\b|bolt|screw|nut|washer|gear|bearing|thread|shaft|bore|teeth|hex\s*head|cadquery|fillet|chamfer|knurl|fastener)\b/i;

/** Match common chat preambles (checked against the start / head of the string). */
const ASSISTANT_PATTERNS: RegExp[] = [
  /^understood[—\-–,.\s]/i,
  /^i['']?d be (happy|glad) to\b/i,
  /^happy to help\b/i,
  /^certainly[!.,\s]/i,
  /what['']?s the small design tweak\b/i,
  /^could you (please )?(share|tell|clarify)\b/i,
  /^tell me (more|about)\b/i,
  /^i need (more )?details?\b/i,
  /^how can i (help|assist)\b/i,
  /^i['']?m (here )?to help\b/i,
  /^as an ai\b/i,
  /^feel free to\b/i,
  /^let me know (if|what)\b/i,
  /^here['']?s (a |some )?(tips?|suggestions?|recommendations?)\b/i,
  /^great (question|choice)[!.,\s]/i,
];

/**
 * True if the string looks like a conversational assistant message, not a part description.
 */
export function looksLikeAssistantReply(text: string): boolean {
  const t = text.trim();
  if (t.length < 24) return false;
  const head = t.slice(0, 320);
  const assistantHit = ASSISTANT_PATTERNS.some((re) => re.test(head));
  if (!assistantHit) return false;
  return !CAD_HINT.test(t);
}
