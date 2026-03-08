// src/lib/profanity.js
// Lightweight client-side profanity detection: supports Chinese/English,
// mixed casing, symbol noise, and simple leetspeak variants (1!l|, a@4, e3, etc.)
// Intended only for front-end filtering; does NOT replace backend moderation.

// Extend this list as needed; supports both Chinese and English entries.
const BASE_LIST = [
  // English
  "fuck",
  "f*ck",
  "f**k",
  "f***",
  "f u c k",
  "fu*k",
  "fuk",
  "fux",
  "fck",
  "shit",
  "sh*t",
  "s**t",
  "sh1t",
  "sh!t",
  "bitch",
  "bi*ch",
  "b!tch",
  "btch",
  "asshole",
  "a**hole",
  "a**",
  "ass",
  "arse",
  "a-hole",
  "bastard",
  "bast*rd",
  "b@stard",
  "dick",
  "d*ck",
  "d!ck",
  "cock",
  "c*ck",
  "c0ck",
  "piss",
  "p!ss",
  "crap",
  "bollocks",
  "wanker",
  "jerk",
  "moron",
  "idiot",
  "retard",
  "slut",
  "whore",
  "hoe",
  "skank",
  "cunt",
  "twat",
  "prick",
  "nigger",
  "nigga",
  "douche",
  "dumbass",
  "jackass",
  "motherfucker",
  "mf",
  "m-f",
  "mofo",
  "kill yourself",
  "go die",
  "suck my",
  "suck ur",
  "f u",
  "f u c",
  "fk u",
  "fk off",
  "f off",
  // Chinese (examples; adjust as needed)
  "傻逼",
  "煞笔",
  "傻b",
  "傻b逼",
  "操你",
  "操你妈",
  "艹",
  "草你",
  "妈的",
  "滚蛋",
  "去死",
  "畜生",
  "傻叉",
  "智障",
  "SB",
];

// Normalize leetspeak / symbol variants back to regular letters
function normalizeForMatch(s) {
  return (
    s
      .toLowerCase()
      // Leet replacements
      .replace(/[¡!]|1|l|\|/g, "i")
      .replace(/[@4]/g, "a")
      .replace(/3/g, "e")
      .replace(/0/g, "o")
      .replace(/[$5]/g, "s")
      .replace(/7/g, "t")
      .replace(/8/g, "b")
      // Collapse extra whitespace
      .replace(/\s+/g, " ")
      // Fold repeated characters (e.g. fuuuuck -> fuuck)
      .replace(/(.)\1{2,}/g, "$1$1")
  );
}

// Build a loose regex for English words that allows punctuation/spacing between letters
function makeLooseWordRegex(word) {
  // Only handle ASCII alphabetic words; Chinese terms use substring matching
  if (!/^[a-z]+$/i.test(word)) return null;
  const letters = word
    .split("")
    .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const body = letters.join("[\\W_]*");
  return new RegExp(`\\b${body}\\b`, "i");
}

// Chinese words are matched via simple includes (after normalization)
function hasChineseBadWord(text, term) {
  return text.includes(term);
}

/**
 * Entry point: detect whether input contains profanity.
 * @param {string} input
 * @param {string[]} extraList - runtime additions (e.g., from localStorage)
 * @returns {{ok:boolean, hits:string[], message?:string}}
 */
export function hasProfanity(input, extraList = []) {
  if (!input || !input.trim()) return { ok: true, hits: [] };

  const src = normalizeForMatch(input);
  const dict = [...new Set([...BASE_LIST, ...extraList])];

  const hits = [];
  for (const termRaw of dict) {
    const term = normalizeForMatch(termRaw);
    if (!term) continue;

    // Chinese terms: use simple substring check
    if (/[^\x00-\x7F]/.test(term)) {
      if (hasChineseBadWord(src, term)) hits.push(termRaw);
      continue;
    }

    // English terms: loose regex that allows spacing/symbols
    const m = makeLooseWordRegex(term);
    if (m && m.test(src)) hits.push(termRaw);
  }

  if (hits.length > 0) {
    const uniq = [...new Set(hits)];
    return {
      ok: false,
      hits: uniq,
      message: `Violation of word rules detected:${uniq
        .slice(0, 5)
        .join("、")}${uniq.length > 5 ? "…" : ""}`,
    };
  }
  return { ok: true, hits: [] };
}
