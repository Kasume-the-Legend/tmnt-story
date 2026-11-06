import D from "./data.json";

const KIND = {
  cold: "COLD OPEN. First scene of the episode: the crew learns of the threat at {place}. Often April on the news/scanner, Casey, Irma, Vernon or Splinter. Name the place, hint at {enemies} and {hazard}. Set up the mission: {objective}.",
  brief: "MISSION BRIEFING at {place}. Allies explain the plan to {objective} and warn about {enemies}, {hazard}, and {boss}.",
  invest: "INVESTIGATION. The hero searches for clues, tracks, signs of a trap. Wary, in character, specific.",
  react: "The hero reacts, mid-episode, to a twist or the midpoint confrontation going wrong.",
  hurt: "SETBACK. The hero is hurt or rattled after the midpoint confrontation and says how they feel.",
  resolve: "RESOLVE. The hero decides to push on and finish it, in their own voice.",
  lair: "REGROUPING IN THE LAIR. Calm strategy talk, dinner, a joke, a plan for the final fight.",
  close: "RESOLUTION / WIND-DOWN. The hero wraps up the episode with a lesson, a joke or a warm moment.",
  twist: "A MIDPOINT TWIST: a surprise reveal about the threat.",
  taunt: "BOSS TAUNT right before the final battle. Menacing but cartoonish, in the villain's own voice.",
  ambush: "FOOT NINJA AMBUSH barks as the hero is jumped. Short, tough, a little silly.",
  setback1: "The Foot / villains gloat after the heroes' first setback.",
  side1: "SUBPLOT banter between Mike and Raph (pizza, pranks, bickering).",
  side2: "SUBPLOT banter between Don and Leo (gadgets, plans, duty).",
  win_pizza: "Victory. Everyone celebrates with pizza.",
  win_joke: "Victory. A closing joke to end the episode.",
};

const fill = (t, st) => t.replace(/\{(\w+)\}/g, (_, k) => (st && st[k]) || "the city");

export function build(pool, recent, extra) {
  const meta = D.pools[pool];
  const st = meta.stage ? D.stages[meta.stage] : null;
  const ids = Object.keys(meta.speakers);
  const sp = ids.map((id) => {
    const key = id === "hero" ? meta.hero : id;
    const c = D.bible.characters[key] || {};
    return `- ${id} (${meta.speakers[id]}): ${c.voice || ""} ${c.traits ? "Traits: " + c.traits + "." : ""} ${c.relationships ? "Relationships: " + c.relationships + "." : ""} Avoid: ${c.avoid || "swearing"}.`;
  }).join("\n");
  const bossLine = meta.kind === "taunt" && meta.speakers ? "" : "";
  const sys = [
    ...D.bible.rules,
    "You write short speech-bubble lines for a TMNT fan game, in the style of a classic Saturday-morning TMNT cartoon episode.",
    "Each line is ONE speech bubble: at most 70 characters, plain ASCII, no emojis, no stage directions, no quotation marks around it.",
    "Every line must be original, specific, and sound like the speaker. No two lines may open the same way.",
    "SCENE: " + fill(KIND[meta.kind] || "Dialogue.", st) + bossLine,
    st ? `LOCATION: ${st.place}. Enemies: ${st.enemies}. Hazard: ${st.hazard}. Boss: ${st.boss}.` : "",
    "SPEAKERS (use these exact ids):\n" + sp,
    extra ? "SEASON NOTE: " + extra : "",
  ].filter(Boolean).join("\n");
  const ex = meta.seeds.slice(0, 4).map((s) => `{"speaker":"${s[0]}","text":"${[s[2], s[3], s[4]].filter(Boolean).join(" ")}"}`).join(",\n");
  const user =
    `Write 10 NEW lines for this scene as a JSON array like:\n[\n${ex}\n]\n` +
    (recent.length ? `Do NOT repeat or paraphrase these recent lines:\n${recent.map((r) => "- " + r).join("\n")}\n` : "") +
    `Allowed speaker ids: ${ids.join(", ")}. Reply with only the JSON array.`;
  return { sys, user, ids };
}
