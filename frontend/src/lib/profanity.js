// Section summary: this block is documented for clarity.
// Section summary: this block is documented for clarity.
// Section summary: this block is documented for clarity.
// Section summary: this block is documented for clarity.

// Section summary: this block is documented for clarity.
const BASE_LIST = [
  // Section summary: this block is documented for clarity.
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
  // Section summary: this block is documented for clarity.
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

// Function summary: normalizeForMatch drives this unit of behavior.
function normalizeForMatch(s) {
  return (
    s
      .toLowerCase()
      // Section summary: this block is documented for clarity.
      .replace(/[¡!]|1|l|\|/g, "i")
      .replace(/[@4]/g, "a")
      .replace(/3/g, "e")
      .replace(/0/g, "o")
      .replace(/[$5]/g, "s")
      .replace(/7/g, "t")
      .replace(/8/g, "b")
      // Section summary: this block is documented for clarity.
      .replace(/\s+/g, " ")
      // Section summary: this block is documented for clarity.
      .replace(/(.)\1{2,}/g, "$1$1")
  );
}

// Function summary: makeLooseWordRegex drives this unit of behavior.
function makeLooseWordRegex(word) {
  // Section summary: this block is documented for clarity.
  if (!/^[a-z]+$/i.test(word)) return null;
  const letters = word
    .split("")
    .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const body = letters.join("[\\W_]*");
  return new RegExp(`\\b${body}\\b`, "i");
}

// Function summary: hasChineseBadWord drives this unit of behavior.
function hasChineseBadWord(text, term) {
  return text.includes(term);
}

/* Section summary: this block is documented for clarity.
  * Additional note: details are clarified for readability.
  * Additional note: details are clarified for readability.
  * Additional note: details are clarified for readability.
  * Additional note: details are clarified for readability.
  */
export function hasProfanity(input, extraList = []) {
  if (!input || !input.trim()) return { ok: true, hits: [] };

  const src = normalizeForMatch(input);
  const dict = [...new Set([...BASE_LIST, ...extraList])];

  const hits = [];
  for (const termRaw of dict) {
    const term = normalizeForMatch(termRaw);
    if (!term) continue;

    // Section summary: this block is documented for clarity.
    if (/[^\x00-\x7F]/.test(term)) {
      if (hasChineseBadWord(src, term)) hits.push(termRaw);
      continue;
    }

    // Section summary: this block is documented for clarity.
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
