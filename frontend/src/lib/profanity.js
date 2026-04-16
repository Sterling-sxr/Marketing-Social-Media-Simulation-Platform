// Section note: groups related logic for readability.
// Section note: groups related logic for readability.
// Section note: groups related logic for readability.
// Section note: groups related logic for readability.

// Section note: groups related logic for readability.
const BASE_LIST = [
  // Section note: groups related logic for readability.
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
  // Section note: groups related logic for readability.
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

// Function note: normalizeForMatch encapsulates this unit of behavior.
function normalizeForMatch(s) {
  return (
    s
      .toLowerCase()
      // Section note: groups related logic for readability.
      .replace(/[¡!]|1|l|\|/g, "i")
      .replace(/[@4]/g, "a")
      .replace(/3/g, "e")
      .replace(/0/g, "o")
      .replace(/[$5]/g, "s")
      .replace(/7/g, "t")
      .replace(/8/g, "b")
      // Section note: groups related logic for readability.
      .replace(/\s+/g, " ")
      // Section note: groups related logic for readability.
      .replace(/(.)\1{2,}/g, "$1$1")
  );
}

// Function note: makeLooseWordRegex encapsulates this unit of behavior.
function makeLooseWordRegex(word) {
  // Section note: groups related logic for readability.
  if (!/^[a-z]+$/i.test(word)) return null;
  const letters = word
    .split("")
    .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const body = letters.join("[\\W_]*");
  return new RegExp(`\\b${body}\\b`, "i");
}

// Function note: hasChineseBadWord encapsulates this unit of behavior.
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

    // Section note: groups related logic for readability.
    if (/[^\x00-\x7F]/.test(term)) {
      if (hasChineseBadWord(src, term)) hits.push(termRaw);
      continue;
    }

    // Section note: groups related logic for readability.
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
