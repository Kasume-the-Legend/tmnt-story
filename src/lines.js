// Pure helpers: validate AI output and turn it into game pool lines.
const BAD = /\b(fuck|shit|bitch|damn|hell|ass|crap|bastard|sex|kill yourself|suicide|nazi|rape)\w*/i;
const ROW = 27, ROWS = 3;

export function clean(s) {
  return String(s || "")
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

// greedy wrap to 3 rows of 27; null if it does not fit
export function wrap(text) {
  const words = clean(text).split(" ").filter(Boolean);
  const rows = []; let cur = "";
  for (const w of words) {
    if (w.length > ROW) return null;
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= ROW) cur += " " + w;
    else { rows.push(cur); cur = w; }
  }
  if (cur) rows.push(cur);
  if (!rows.length || rows.length > ROWS) return null;
  while (rows.length < ROWS) rows.push("");
  return rows;
}

export function checkLine(speaker, text, allowed) {
  if (!allowed.includes(speaker)) return null;
  const t = clean(text);
  if (t.length < 8 || t.length > 78) return null;
  if (BAD.test(t) || /as an ai|language model|\[|\]|\{|\}/i.test(t)) return null;
  if (/[<>]/.test(t)) return null;
  return wrap(t);
}

const ex = (s) => (s.trim() ? s.trim().replace(/\s+/g, "_") : "-");

// one game pool line: say <speaker> <NAME> <r1> <r2> <r3>
export function gameLine(speaker, name, rows) {
  return `say ${speaker} ${ex(name)} ${rows.map(ex).join(" ")}`;
}

export function poolFile(lines) {
  const u = [...new Set(lines)];
  return u.length + "\n" + u.join("\n") + "\n";
}

// pull a JSON array out of a model reply, tolerating chatter and code fences
export function parseArray(reply) {
  let s = typeof reply === "string" ? reply : JSON.stringify(reply ?? "");
  s = s.replace(/```(?:json)?/gi, "");
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if (a >= 0 && b > a) {
    try { const v = JSON.parse(s.slice(a, b + 1)); if (Array.isArray(v)) return v; } catch {}
  }
  const out = [], re = /\{[^{}]*\}/g; let m;
  while ((m = re.exec(s))) { try { out.push(JSON.parse(m[0])); } catch {} }
  return out;
}
