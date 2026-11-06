import { DurableObject } from "cloudflare:workers";
import D from "./data.json";
import { build } from "./prompt.js";
import { checkLine, gameLine, poolFile, parseArray } from "./lines.js";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const KEEP_GENERATED = 30;   // newest AI lines kept per pool in a pack
const MIN_TOTAL = 12;        // pad with built-in lines up to this many
const POOLS = Object.keys(D.pools);

const json = (o, s = 200, h = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "access-control-allow-origin": "*", ...h } });

export class StoryStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS lines(
      id INTEGER PRIMARY KEY AUTOINCREMENT, pool TEXT, speaker TEXT, name TEXT,
      r1 TEXT, r2 TEXT, r3 TEXT, ver INTEGER, created INTEGER,
      UNIQUE(pool, r1, r2, r3));
      CREATE INDEX IF NOT EXISTS lines_pool ON lines(pool, id);
      CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);`);
  }
  getMeta(k, d = "") { const r = this.sql.exec("SELECT v FROM meta WHERE k=?", k).toArray(); return r.length ? r[0].v : d; }
  setMeta(k, v) { this.sql.exec("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", k, String(v)); }
  version() { return Number(this.getMeta("ver", "0")); }

  stats() {
    const rows = this.sql.exec("SELECT pool, COUNT(*) n FROM lines GROUP BY pool").toArray();
    const by = Object.fromEntries(rows.map((r) => [r.pool, r.n]));
    return { version: this.version(), pools: POOLS.length, generated: rows.reduce((a, r) => a + r.n, 0), byPool: by };
  }

  // which pools need lines most (fewest generated, then least recently touched)
  pickPools(n) {
    const by = this.stats().byPool;
    return POOLS.map((p) => ({ p, n: by[p] || 0, t: Number(this.getMeta("t:" + p, "0")) }))
      .sort((a, b) => a.n - b.n || a.t - b.t).slice(0, n).map((x) => x.p);
  }

  async generate(pools, count = 4) {
    const targets = pools && pools.length ? pools.filter((p) => D.pools[p]) : this.pickPools(count);
    const result = {};
    let added = 0;
    const ver = this.version() + 1;
    for (const pool of targets) {
      const meta = D.pools[pool];
      const recent = this.sql.exec("SELECT r1,r2,r3 FROM lines WHERE pool=? ORDER BY id DESC LIMIT 12", pool)
        .toArray().map((r) => [r.r1, r.r2, r.r3].filter(Boolean).join(" "));
      const { sys, user, ids } = build(pool, recent, this.getMeta("season_note"));
      let got = 0;
      try {
        const out = await this.env.AI.run(MODEL, {
          messages: [{ role: "system", content: sys }, { role: "user", content: user }],
          max_tokens: 900, temperature: 0.95, top_p: 0.92,
        });
        for (const it of parseArray(out.response ?? out)) {
          const speaker = String(it.speaker || "").toLowerCase().trim();
          const rows = checkLine(speaker, it.text, ids);
          if (!rows) continue;
          const name = meta.speakers[speaker];
          try {
            this.sql.exec("INSERT INTO lines(pool,speaker,name,r1,r2,r3,ver,created) VALUES(?,?,?,?,?,?,?,?)",
              pool, speaker, name, rows[0], rows[1], rows[2], ver, Date.now());
            got++;
          } catch {} // duplicate
        }
      } catch (e) { result[pool] = "error: " + e.message; continue; }
      this.setMeta("t:" + pool, Date.now());
      result[pool] = got; added += got;
    }
    if (added) {
      this.setMeta("ver", ver);
      // trim old generated lines per touched pool
      for (const pool of targets) this.sql.exec(
        "DELETE FROM lines WHERE pool=? AND id NOT IN (SELECT id FROM lines WHERE pool=? ORDER BY id DESC LIMIT ?)", pool, pool, KEEP_GENERATED);
    }
    return { version: this.version(), added, result };
  }

  // pack: pool files changed since `since`
  pack(since) {
    const files = {};
    const changed = this.sql.exec("SELECT DISTINCT pool FROM lines WHERE ver>?", since).toArray().map((r) => r.pool);
    for (const pool of changed) {
      const meta = D.pools[pool]; if (!meta) continue;
      const gen = this.sql.exec("SELECT speaker,name,r1,r2,r3 FROM lines WHERE pool=? ORDER BY id DESC LIMIT ?", pool, KEEP_GENERATED).toArray()
        .map((r) => gameLine(r.speaker, r.name, [r.r1, r.r2, r.r3]));
      let lines = gen.slice();
      const seeds = meta.seeds.map((s) => gameLine(s[0], s[1], [s[2], s[3], s[4]]));
      for (const s of seeds) { if (lines.length >= Math.max(MIN_TOTAL, gen.length + 4)) break; lines.push(s); }
      files[`data/cutscenes/tm/pools/${pool}.txt`] = poolFile(lines);
    }
    return { version: this.version(), files };
  }

  setNote(n) { this.setMeta("season_note", String(n).slice(0, 400)); return { ok: true }; }
}

const store = (env) => env.STORE.get(env.STORE.idFromName("main"));
const authed = (req, env) => {
  if (!env.ADMIN_TOKEN) return false;
  const key = new URL(req.url).searchParams.get("key");
  return req.headers.get("authorization") === "Bearer " + env.ADMIN_TOKEN || key === env.ADMIN_TOKEN;
};

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return json({}, 204, { "access-control-allow-headers": "*" });
    if (u.pathname === "/" || u.pathname === "/health")
      return json({ ok: true, service: "tmnt-story", pools: POOLS.length, version: await store(env).version() });
    if (u.pathname === "/pack") {
      const since = Math.max(0, parseInt(u.searchParams.get("since") || "0", 10) || 0);
      return json(await store(env).pack(since), 200, { "cache-control": "public, max-age=300" });
    }
    if (u.pathname.startsWith("/admin/")) {
      if (!authed(req, env)) return json({ error: "unauthorized" }, 401);
      if (u.pathname === "/admin/generate") {
        const pools = (u.searchParams.get("pools") || "").split(",").filter(Boolean);
        const n = Math.min(12, parseInt(u.searchParams.get("n") || "6", 10) || 6);
        return json(await store(env).generate(pools, n));
      }
      if (u.pathname === "/admin/stats") return json(await store(env).stats());
      if (u.pathname === "/admin/note" && req.method === "POST") return json(await store(env).setNote(await req.text()));
    }
    return json({ error: "not found" }, 404);
  },
  async scheduled(_evt, env, ctx) {
    ctx.waitUntil(store(env).generate([], 4));
  },
};
