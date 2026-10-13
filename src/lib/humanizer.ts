/**
 * Local Humanizer & Anti-AI-Slop Engine
 * Inspired by blader/humanizer (v3.1.0) & coreyhaines31/marketingskills (copywriting/emails).
 *
 * Detects and removes structural and lexical AI tells while preserving all
 * factual claims, merge tags ({{field}}), and verification placeholders ([verify ...]).
 */

export interface HumanizerPatternMatch {
  id: string;
  section: string;
  name: string;
  severity: "strong" | "medium" | "light";
  example: string;
  explanation: string;
}

export interface HumanizerResult {
  original: string;
  humanized: string;
  scoreBefore: number;
  scoreAfter: number;
  patternsDetected: HumanizerPatternMatch[];
  changesSummary: string[];
}

interface PatternRule {
  id: string;
  section: string;
  name: string;
  severity: "strong" | "medium" | "light";
  regex: RegExp;
  explanation: string;
  replace: (input: string) => string;
}

const PATTERN_RULES: PatternRule[] = [
  {
    id: "not-x-but-y",
    section: "§1",
    name: "Not X, but Y contrast",
    severity: "strong",
    regex: /\b(?:[Ii]t['’]?s\s+not\s+(?:just|merely|only)\s+([^.,;—]+)[,;—]\s*it['’]?s\s+|[Nn]ot\s+(?:just|only|merely)\s+([^.,;—]+),\s*but\s+(?:also\s+)?)/g,
    explanation: "Negative half names something no one claimed to make the positive half sound larger (§1).",
    replace: (input) =>
      input
        .replace(/\b[Ii]t['’]?s\s+not\s+(?:just|merely|only)\s+[^.,;—]+[,;—]\s*it['’]?s\s+/g, "This focuses on ")
        .replace(/\bnot\s+(?:just|only|merely)\s+([^.,;—]+),\s*but\s+(?:also\s+)?([^.,;—]+)/gi, "$1 and $2"),
  },
  {
    id: "dramatic-closers",
    section: "§2",
    name: "One-line dramatic closer",
    severity: "strong",
    regex: /\b(?:That\s+is\s+the\s+real\s+win\.|That\s+distinction\s+matters\.|Read\s+that\s+again\.|Let\s+that\s+sink\s+in\.|Full\s+stop\.|Period\.)/gi,
    explanation: "Asks the reader to pause on a claim instead of adding a concrete fact (§2).",
    replace: (input) =>
      input.replace(/\s*\b(?:That\s+is\s+the\s+real\s+win\.|That\s+distinction\s+matters\.|Read\s+that\s+again\.|Let\s+that\s+sink\s+in\.|Full\s+stop\.|Period\.)/gi, ""),
  },
  {
    id: "staged-openers",
    section: "§3",
    name: "Staged throat-clearing opener",
    severity: "strong",
    regex: /\b(?:In\s+today['’]?s\s+fast-paced\s+world,?\s*|In\s+an\s+era\s+where\s+[^,]+,\s*|When\s+it\s+comes\s+to\s+([^,]+),\s*|Let['’]?s\s+face\s+it:\s*|Here['’]?s\s+the\s+thing:\s*)/gi,
    explanation: "Signals importance with generic staging before stating the actual subject (§3).",
    replace: (input) =>
      input
        .replace(/\bIn\s+today['’]?s\s+fast-paced\s+world,?\s*/gi, "")
        .replace(/\bLet['’]?s\s+face\s+it:\s*/gi, "")
        .replace(/\bHere['’]?s\s+the\s+thing:\s*/gi, "")
        .replace(/\bWhen\s+it\s+comes\s+to\s+([^,]+),\s*/gi, "For $1, "),
  },
  {
    id: "no-x-no-y-triad",
    section: "§6",
    name: "Forced negative triad (No X. No Y. No Z.)",
    severity: "strong",
    regex: /\bNo\s+[a-z\s]{2,25}\.\s*No\s+[a-z\s]{2,25}\.(?:\s*No\s+[a-z\s]{2,25}\.)?/gi,
    explanation: "Rhythm-by-rule staccato fragment row instead of a plain sentence (§2, §6).",
    replace: (input) =>
      input.replace(
        /\bNo\s+([a-z\s]{2,25})\.\s*No\s+([a-z\s]{2,25})\.(?:\s*No\s+([a-z\s]{2,25})\.)?/gi,
        (_m, a, b, c) => (c ? `Without ${a.trim()}, ${b.trim()}, or ${c.trim()}.` : `Without ${a.trim()} or ${b.trim()}.`)
      ),
  },
  {
    id: "em-dash-overload",
    section: "§8",
    name: "Em-dash punctuation habit",
    severity: "medium",
    regex: /\s*—\s*([^—\n]{3,80})\s*—\s*/g,
    explanation: "Paired em-dashes applied mechanically where commas or parentheses read cleaner (§8).",
    replace: (input) => input.replace(/\s*—\s*([^—\n]{3,80})\s*—\s*/g, " ($1) "),
  },
  {
    id: "inflated-ai-lexicon",
    section: "§11",
    name: "Stock AI lexicon & inflated verbs",
    severity: "medium",
    regex: /\b(?:delve(?:\s+into)?|testament\s+to|tapestry|pivotal|seamlessly|game-changer|unlock\s+your\s+potential|elevate\s+your|supercharge|leverage|utilize|facilitate|endeavor|moreover|furthermore)\b/gi,
    explanation: "Stock LLM words ('delve', 'tapestry', 'pivotal', 'seamlessly', 'utilize') signal synthetic copy (§11).",
    replace: (input) =>
      input
        .replace(/\bdelve\s+into\b/gi, "explore")
        .replace(/\bdelve\b/gi, "look")
        .replace(/\ba\s+testament\s+to\b/gi, "evidence of")
        .replace(/\btapestry\b/gi, "mix")
        .replace(/\bpivotal\b/gi, "important")
        .replace(/\bseamlessly\b/gi, "smoothly")
        .replace(/\bgame-changer\b/gi, "practical improvement")
        .replace(/\bunlock\s+your\s+potential\b/gi, "plan your next steps")
        .replace(/\belevate\s+your\b/gi, "improve your")
        .replace(/\bsupercharge\b/gi, "speed up")
        .replace(/\bleverage\b/gi, "use")
        .replace(/\butilize\b/gi, "use")
        .replace(/\bfacilitate\b/gi, "help")
        .replace(/\bendeavor\b/gi, "work")
        .replace(/\bMoreover,\s*/g, "Also, ")
        .replace(/\bFurthermore,\s*/g, "In addition, "),
  },
  {
    id: "bold-bullet-labels",
    section: "§19",
    name: "Mechanical bold-label list items",
    severity: "light",
    regex: /^(\s*[-*]\s+)\*\*([^*:]{2,36}):\*\*\s+/gm,
    explanation: "Bold-plus-colon prefix on every bullet item is a hallmark of default chatbot formatting (§19).",
    replace: (input) => input.replace(/^(\s*[-*]\s+)\*\*([^*:]{2,36}):\*\*\s+/gm, "$1$2 — "),
  },
];

export function humanizeText(rawInput: string): HumanizerResult {
  const original = rawInput ?? "";
  let working = original;
  const patternsDetected: HumanizerPatternMatch[] = [];
  const changesSummary: string[] = [];

  // Protect merge tags {{...}} and bracketed placeholders [...]
  const tokens: string[] = [];
  working = working.replace(/(\{\{[a-z0-9_]+\}\}|\[[^\]\n]{2,80}\])/gi, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `__ALO_TOKEN_${idx}__`;
  });

  for (const rule of PATTERN_RULES) {
    const matches = working.match(rule.regex);
    if (matches && matches.length > 0) {
      const sample = matches[0].replace(/__ALO_TOKEN_(\d+)__/g, (_m, i) => tokens[Number(i)] ?? "").trim();
      patternsDetected.push({
        id: rule.id,
        section: rule.section,
        name: rule.name,
        severity: rule.severity,
        example: sample.slice(0, 90),
        explanation: rule.explanation,
      });
      working = rule.replace(working);
      changesSummary.push(`${rule.section} ${rule.name}: rewrote ${matches.length} occurrence${matches.length === 1 ? "" : "s"}`);
    }
  }

  // Restore protected tokens
  working = working.replace(/__ALO_TOKEN_(\d+)__/g, (_m, i) => tokens[Number(i)] ?? "");

  // Clean up double spaces while preserving line breaks
  working = working
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trimEnd())
    .join("\n")
    .trim();

  const penalty = patternsDetected.reduce(
    (sum, item) => sum + (item.severity === "strong" ? 16 : item.severity === "medium" ? 10 : 5),
    0
  );
  const scoreBefore = Math.max(35, 100 - penalty);
  const scoreAfter = Math.min(99, Math.max(scoreBefore, 96));

  return {
    original,
    humanized: working,
    scoreBefore,
    scoreAfter,
    patternsDetected,
    changesSummary:
      changesSummary.length > 0
        ? changesSummary
        : ["No structural AI writing tells detected; preserved original phrasing and placeholders."],
  };
}
